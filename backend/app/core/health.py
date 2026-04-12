"""
Readiness checks: PostgreSQL (async session) and Redis (shared async client).

Used by ``HealthCheckService.readiness`` and ``GET /api/v1/system/ready``.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import text

from app.infrastructure.cache import ensure_async_redis_client
from app.infrastructure.database import AsyncSessionLocal
from app.schemas.system import ReadinessChecks, ReadinessResponse

logger = logging.getLogger(__name__)

CHECK_TIMEOUT_S = 2.0


def _error_message(exc: BaseException) -> str:
    if isinstance(exc, asyncio.TimeoutError):
        return f"error: timed out after {CHECK_TIMEOUT_S}s"
    msg = str(exc).strip() or exc.__class__.__name__
    return f"error: {msg}"


async def _check_database() -> str:
    async def _ping() -> None:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(_ping(), timeout=CHECK_TIMEOUT_S)
        return "ok"
    except asyncio.TimeoutError:
        logger.warning(
            "Database readiness check timed out after %.1fs",
            CHECK_TIMEOUT_S,
        )
        return _error_message(asyncio.TimeoutError())
    except Exception as e:
        logger.warning("Database readiness check failed: %s", e, exc_info=True)
        return _error_message(e)


async def _check_redis() -> str:
    async def _ping() -> None:
        client = await ensure_async_redis_client()
        await client.ping()

    try:
        await asyncio.wait_for(_ping(), timeout=CHECK_TIMEOUT_S)
        return "ok"
    except asyncio.TimeoutError:
        logger.warning(
            "Redis readiness check timed out after %.1fs",
            CHECK_TIMEOUT_S,
        )
        return _error_message(asyncio.TimeoutError())
    except Exception as e:
        logger.warning("Redis readiness check failed: %s", e, exc_info=True)
        return _error_message(e)


async def run_readiness_checks() -> ReadinessResponse:
    database, redis = await asyncio.gather(_check_database(), _check_redis())
    checks = ReadinessChecks(database=database, redis=redis)
    overall: str = (
        "ready" if database == "ok" and redis == "ok" else "not_ready"
    )
    return ReadinessResponse(status=overall, checks=checks)
