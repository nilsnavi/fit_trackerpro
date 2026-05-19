"""
Health check service for dependency-aware readiness checks.
Implements:
- /health/live → liveness (app is running)
- /health/ready → readiness (all dependencies are healthy)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Optional

from sqlalchemy import text

from app.infrastructure.database import engine
from app.schemas.system import (
    DependencyStatus,
    LivenessResponse,
    ReadinessResponse,
)
from app.settings import settings

logger = logging.getLogger(__name__)


class HealthCheckService:
    """Dependency-aware health checks for production readiness."""

    @staticmethod
    async def liveness() -> LivenessResponse:
        """
        Liveness probe: simple check that app is running.
        Used by Docker to determine if container should be restarted.
        """
        return LivenessResponse(
            status="alive",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    @staticmethod
    async def readiness() -> ReadinessResponse:
        """
        Readiness probe: checks all critical dependencies.
        Used by load balancers to route traffic only to ready instances.
        """
        timestamp = datetime.utcnow().isoformat() + "Z"
        dependencies: dict[str, DependencyStatus] = {}

        # Check database connectivity
        db_status = await HealthCheckService._check_database()
        dependencies["database"] = db_status

        # Check Redis (if configured)
        redis_status = await HealthCheckService._check_redis()
        if redis_status is not None:
            dependencies["redis"] = redis_status

        # Check external services (Telegram bot if enabled)
        telegram_status = await HealthCheckService._check_external_services()
        if telegram_status is not None:
            dependencies["external_services"] = telegram_status

        # Overall status: ready only if all checked dependencies are healthy
        is_ready = all(
            dep.healthy for dep in dependencies.values()
        )

        return ReadinessResponse(
            status="ready" if is_ready else "not_ready",
            timestamp=timestamp,
            dependencies=dependencies,
        )

    @staticmethod
    async def _check_database() -> DependencyStatus:
        """Check database connectivity."""
        start = time.monotonic()
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            elapsed = (time.monotonic() - start) * 1000
            return DependencyStatus(
                name="database",
                healthy=True,
                response_time_ms=round(elapsed, 1),
                message=None,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            logger.error("Database health check failed: %s", str(e))
            return DependencyStatus(
                name="database",
                healthy=False,
                response_time_ms=round(elapsed, 1),
                message=f"Database connection failed: {str(e)}",
            )

    @staticmethod
    async def _check_redis() -> Optional[DependencyStatus]:
        """Check Redis connectivity (if enabled)."""
        if not settings.ANALYTICS_CACHE_ENABLED:
            return None

        start = time.monotonic()
        try:
            from redis.asyncio import Redis

            redis_client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )

            try:
                await redis_client.ping()
                elapsed = (time.monotonic() - start) * 1000
                return DependencyStatus(
                    name="redis",
                    healthy=True,
                    response_time_ms=round(elapsed, 1),
                    message=None,
                )
            finally:
                await redis_client.aclose()

        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            logger.error("Redis health check failed: %s", str(e))
            return DependencyStatus(
                name="redis",
                healthy=False,
                response_time_ms=round(elapsed, 1),
                message=f"Redis connection failed: {str(e)}",
            )

    @staticmethod
    async def _check_external_services() -> Optional[DependencyStatus]:
        """Check external services (e.g., Telegram bot)."""
        if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_BOT_ENABLED:
            return None

        # For now, we check if the token is configured and valid format
        # In production, you might want to actually test bot API connectivity
        start = time.monotonic()
        try:
            if not settings.TELEGRAM_BOT_TOKEN or len(settings.TELEGRAM_BOT_TOKEN) < 10:
                elapsed = (time.monotonic() - start) * 1000
                return DependencyStatus(
                    name="external_services",
                    healthy=False,
                    response_time_ms=round(elapsed, 1),
                    message="Telegram bot token not properly configured",
                )

            # Token format is valid (basic check)
            elapsed = (time.monotonic() - start) * 1000
            return DependencyStatus(
                name="external_services",
                healthy=True,
                response_time_ms=round(elapsed, 1),
                message=None,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            logger.error("External services health check failed: %s", str(e))
            return DependencyStatus(
                name="external_services",
                healthy=False,
                response_time_ms=round(elapsed, 1),
                message=f"External services check failed: {str(e)}",
            )
