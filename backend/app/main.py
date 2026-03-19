"""
FitTracker Pro - FastAPI Backend Application
"""
import logging
import sentry_sdk
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.api import (
    health,
    auth,
    users,
    workouts,
    exercises,
    health as health_router,
    analytics,
    achievements,
    challenges,
    emergency,
)
from app.middleware.rate_limit import RateLimitMiddleware
from app.utils.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    logger.info("Starting up FitTracker Pro API...")
    # Startup logic here (database connections, etc.)
    yield
    # Shutdown logic here
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
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(
    workouts.router, prefix="/api/v1/workouts", tags=["workouts"])
app.include_router(
    exercises.router, prefix="/api/v1/exercises", tags=["exercises"])
app.include_router(health_router.router,
                   prefix="/api/v1/health", tags=["health"])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
