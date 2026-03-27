"""
FitTracker Pro - FastAPI Backend Application
"""
import logging
import asyncio
import sentry_sdk
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.api import (
    system,
    auth,
    users,
    workouts,
    exercises,
    health,
    analytics,
    achievements,
    challenges,
    emergency,
)
from app.middleware.rate_limit import RateLimitMiddleware
from app.utils.config import settings
from app.bot import setup_bot, start_bot, start_bot_webhook, stop_bot, process_webhook_update

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot task reference
_bot_task = None

# Initialize Sentry if DSN is configured
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
    )
    logger.info("Sentry initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global _bot_task
    logger.info("Starting up FitTracker Pro API...")

    # Start Telegram bot
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            bot_app = setup_bot()
            if bot_app:
                if settings.ENVIRONMENT == "production":
                    # Use webhook mode in production
                    await start_bot_webhook(bot_app)
                    logger.info("Telegram bot started in webhook mode")
                else:
                    # Use polling mode in development
                    _bot_task = asyncio.create_task(start_bot(bot_app))
                    logger.info("Telegram bot started in polling mode")
        except Exception as e:
            logger.error(f"Failed to start Telegram bot: {e}")
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set, bot not started")

    yield

    # Shutdown bot
    if _bot_task:
        try:
            await stop_bot()
            _bot_task.cancel()
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")

    logger.info("Shutting down FitTracker Pro API...")


app = FastAPI(
    title="FitTracker Pro API",
    description="""
    Backend API for FitTracker Pro Telegram Mini App
    
    ## Authentication
    All endpoints (except auth) require JWT Bearer token in Authorization header:
    ```
    Authorization: Bearer <access_token>
    ```
    
    ## Rate Limiting
    API has rate limiting enabled. Limits vary by endpoint.
    Check X-RateLimit-* headers in responses.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

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

# Include routers
app.include_router(system.router, prefix="/api/v1/system", tags=["system"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(
    workouts.router, prefix="/api/v1/workouts", tags=["workouts"])
app.include_router(
    exercises.router, prefix="/api/v1/exercises", tags=["exercises"])
app.include_router(health.router, prefix="/api/v1/health-metrics", tags=["health-metrics"])
app.include_router(
    analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(achievements.router,
                   prefix="/api/v1/achievements", tags=["achievements"])
app.include_router(challenges.router,
                   prefix="/api/v1/challenges", tags=["challenges"])
app.include_router(
    emergency.router, prefix="/api/v1/emergency", tags=["emergency"])


@app.get("/")
async def root():
    return {
        "message": "FitTracker Pro API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/telegram/webhook")
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
        logger.error(f"Error processing webhook update: {e}")
        return Response(status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
