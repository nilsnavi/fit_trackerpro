"""
FitTracker Pro - FastAPI Backend Application
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.exception_handlers import register_exception_handlers
from app.api.v1.openapi_tags import OPENAPI_TAGS, TAG_INTEGRATIONS, TAG_SYSTEM
from app.api.v1.registration import register_v1_routes
from app.api.v1.system import health_check_response
from app.application.health_check_service import HealthCheckService
from app.bot import process_webhook_update, setup_bot, start_bot, start_bot_webhook, stop_bot
from app.core.logging import configure_logging
from app.core.telemetry import init_sentry, setup_prometheus_metrics
from app.infrastructure.cache import close_cache
from app.infrastructure.database import close_db, init_db
from app.middleware.rate_limit import (
    RateLimitMiddleware,
    close_rate_limit_redis_client,
    create_rate_limit_redis_client,
)
from app.middleware.request_correlation import RequestCorrelationMiddleware
from app.middleware.request_logging import StructuredRequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.sentry_scope import SentryUserContextMiddleware
from app.schemas.system import HealthCheckResponse, LivenessResponse, ReadinessResponse
from app.settings import settings

configure_logging(settings)
logger = logging.getLogger(__name__)
init_sentry(settings)

# Bot task reference (polling mode)
_bot_task = None

_PYTEST = os.environ.get("PYTEST_RUNNING") == "1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: DB check, Redis for rate limit, optional Telegram bot. Shutdown releases all."""
    global _bot_task
    logger.info("Starting up FitTracker Pro API...")

    await init_db()
    logger.info("Database connection OK")

    app.state.redis_rate_limit = None
    if not _PYTEST:
        app.state.redis_rate_limit = create_rate_limit_redis_client()
        if app.state.redis_rate_limit:
            logger.info("Redis (rate limiting) connected")
        else:
            logger.info("Redis (rate limiting) unavailable; using in-memory counters")

    bot_started = False
    if not _PYTEST and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_BOT_ENABLED:
        try:
            bot_app = setup_bot()
            if bot_app:
                bot_started = True
                if settings.ENVIRONMENT == "production":
                    await start_bot_webhook(bot_app)
                    logger.info("Telegram bot started in webhook mode")
                else:
                    _bot_task = asyncio.create_task(start_bot(bot_app))
                    logger.info("Telegram bot started in polling mode")
        except Exception as e:
            logger.error("Failed to start Telegram bot: %s", e)
    elif not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set, bot not started")
    elif not settings.TELEGRAM_BOT_ENABLED:
        logger.info("Telegram bot runtime disabled (TELEGRAM_BOT_ENABLED=false)")

    try:
        yield
    finally:
        logger.info("Shutting down FitTracker Pro API...")

        if bot_started:
            try:
                await stop_bot()
                if _bot_task:
                    _bot_task.cancel()
                    try:
                        await _bot_task
                    except asyncio.CancelledError:
                        pass
            except Exception as e:
                logger.error("Error stopping bot: %s", e)
            finally:
                _bot_task = None

        if not _PYTEST:
            try:
                await close_cache()
            except Exception as e:
                logger.warning("Error closing analytics cache Redis: %s", e)
            try:
                close_rate_limit_redis_client(getattr(app.state, "redis_rate_limit", None))
                app.state.redis_rate_limit = None
            except Exception as e:
                logger.warning("Error closing rate-limit Redis: %s", e)
            try:
                await close_db()
            except Exception as e:
                logger.warning("Error disposing database engine: %s", e)


app = FastAPI(
    title=f'{settings.APP_NAME} API',
    description="""
    Backend API for FitTracker Pro Telegram Mini App
    
    ## Authentication
    **Public (no JWT):** ``GET /`` and ``GET /health``, ``/api/v1/system/*``,
    ``POST /api/v1/users/auth/telegram``, ``POST /api/v1/users/auth/refresh``,
    ``POST /api/v1/users/``, ``GET /api/v1/users/{user_id}``, plus integration webhooks.

    **Authenticated:** all other ``/api/v1`` routes require a Bearer access token:
    ```
    Authorization: Bearer <access_token>
    ```
    
    ## Rate Limiting
    API has rate limiting enabled. Tiers: default (read), auth, system, write, plus
    stricter policies for Telegram login, analytics export, and emergency notify.
    Limits apply per Telegram user when a valid access token, refresh token (on ``/auth/refresh``),
    or validated WebApp initData (on Telegram login) is present; otherwise per client IP.
    Responses include ``X-RateLimit-Limit``, ``X-RateLimit-Remaining``, ``X-RateLimit-Reset``,
    ``X-RateLimit-Window``, ``X-RateLimit-Policy``, and matching ``RateLimit-*`` headers.
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

register_exception_handlers(app)

# Middleware order: first registered = innermost (closest to routes).
app.add_middleware(SentryUserContextMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# Access logging (duration includes rate limit; request id set by outer middleware)
app.add_middleware(StructuredRequestLoggingMiddleware)

# Baseline security headers on all API responses
app.add_middleware(SecurityHeadersMiddleware)

# Request / correlation ID: outermost so all layers and error handlers see contextvars
app.add_middleware(RequestCorrelationMiddleware)

register_v1_routes(app)

setup_prometheus_metrics(app, settings)


@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=[TAG_SYSTEM],
    summary="Liveness probe (alias)",
    include_in_schema=False,
)
async def health_probe():
    return health_check_response()


@app.get(
    "/health/live",
    tags=[TAG_SYSTEM],
    summary="Liveness probe (container is running)",
    response_model=LivenessResponse,
)
async def app_liveness():
    """
    Liveness probe for container orchestration.
    Returns 200 if the application process is running.
    Used by Docker/Kubernetes to determine if container should be restarted.
    """
    return await HealthCheckService.liveness()


@app.get(
    "/health/ready",
    tags=[TAG_SYSTEM],
    summary="Readiness probe (dependencies are healthy)",
    response_model=ReadinessResponse,
)
async def app_readiness():
    """
    Readiness probe for load balancers and orchestrators.
    Checks all critical dependencies:
    - Database connectivity
    - Redis availability (if configured)
    - External services (if configured)

    Returns 200 only if the application is ready to serve traffic.
    Used by load balancers to route traffic only to ready instances.
    """
    readiness = await HealthCheckService.readiness()
    if readiness.status != 'ready':
        return JSONResponse(status_code=503, content=readiness.model_dump())
    return readiness


@app.get("/", tags=[TAG_SYSTEM])
async def root():
    return {
        "message": f"{settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.post("/telegram/webhook", tags=[TAG_INTEGRATIONS])
async def telegram_webhook(request: Request):
    """
    Handle incoming Telegram webhook updates

    This endpoint receives updates from Telegram when using webhook mode.
    Only used in production environment.
    """
    try:
        update_data = await request.json()
        await process_webhook_update(update_data)
        return Response(status_code=200)
    except Exception as e:
        logger.exception(
            "telegram_webhook_error",
            extra={"event": "telegram_webhook_error"},
        )
        sentry_sdk.capture_exception(e)
        return Response(status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
