"""
Readiness checks: PostgreSQL, Redis, Alembic migration head vs database.

Used by ``HealthCheckService.readiness`` and ``GET /api/v1/system/ready``.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from app.infrastructure.database import engine
from app.schemas.system import (
    ReadinessCheckDatabase,
    ReadinessChecks,
    ReadinessCheckRedis,
    ReadinessMigrationsCheck,
    ReadinessResponse,
)
from app.settings import BACKEND_DIR, settings

logger = logging.getLogger(__name__)

READY_OUTER_TIMEOUT_S = 5.0
DB_CHECK_TIMEOUT_S = 2.0
REDIS_CHECK_TIMEOUT_S = 1.0


def utc_timestamp_z() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def resolve_alembic_ini_path() -> Path | None:
    """Resolve ``alembic.ini`` for migration head comparison."""
    raw = (settings.ALEMBIC_INI_PATH or "").strip()
    if raw:
        p = Path(raw).expanduser()
        return p if p.is_file() else None

    embedded = BACKEND_DIR / "embedded_migrations" / "alembic.ini"
    if embedded.is_file():
        return embedded

    monorepo = BACKEND_DIR.parent / "database" / "migrations" / "alembic.ini"
    if monorepo.is_file():
        return monorepo

    return None


def _alembic_head_revision(ini_path: Path) -> str | None:
    cfg = Config(str(ini_path))
    script = ScriptDirectory.from_config(cfg)
    return script.get_current_head()


async def _check_database(timeout_s: float) -> ReadinessCheckDatabase:
    start = time.monotonic()

    async def _ping() -> None:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(_ping(), timeout=timeout_s)
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        return ReadinessCheckDatabase(status="ok", latency_ms=latency_ms)
    except asyncio.TimeoutError:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        logger.warning("Database readiness check timed out after %.1fs", timeout_s)
        return ReadinessCheckDatabase(status="error", latency_ms=latency_ms)
    except Exception:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        logger.exception("Database readiness check failed")
        return ReadinessCheckDatabase(status="error", latency_ms=latency_ms)


async def _check_redis(timeout_s: float) -> ReadinessCheckRedis:
    start = time.monotonic()
    try:
        from redis.asyncio import Redis

        redis_client = Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=min(timeout_s, 1.0),
            socket_timeout=min(timeout_s, 1.0),
        )
        try:

            async def _ping() -> None:
                await redis_client.ping()

            await asyncio.wait_for(_ping(), timeout=timeout_s)
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            return ReadinessCheckRedis(status="ok", latency_ms=latency_ms)
        finally:
            await redis_client.aclose()
    except asyncio.TimeoutError:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        logger.warning("Redis readiness check timed out after %.1fs", timeout_s)
        return ReadinessCheckRedis(status="error", latency_ms=latency_ms)
    except Exception:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        logger.exception("Redis readiness check failed")
        return ReadinessCheckRedis(status="error", latency_ms=latency_ms)


async def _check_migrations(ini_path: Path | None, timeout_s: float) -> ReadinessMigrationsCheck:
    if ini_path is None:
        return ReadinessMigrationsCheck(status="error", current=None, head=None)

    start = time.monotonic()

    async def _run() -> ReadinessMigrationsCheck:
        head = await asyncio.to_thread(_alembic_head_revision, ini_path)
        if not head:
            return ReadinessMigrationsCheck(status="error", current=None, head=None)

        try:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                row = result.first()
        except (ProgrammingError, OperationalError, SQLAlchemyError) as e:
            logger.warning("Could not read alembic_version: %s", e)
            return ReadinessMigrationsCheck(status="error", current=None, head=head)

        if row is None:
            return ReadinessMigrationsCheck(status="pending", current=None, head=head)

        current = str(row[0])
        if current == head:
            return ReadinessMigrationsCheck(status="ok", current=current, head=head)
        return ReadinessMigrationsCheck(status="pending", current=current, head=head)

    try:
        return await asyncio.wait_for(_run(), timeout=timeout_s)
    except asyncio.TimeoutError:
        logger.warning("Migrations readiness check timed out after %.1fs", timeout_s)
        try:
            head = await asyncio.wait_for(
                asyncio.to_thread(_alembic_head_revision, ini_path),
                timeout=max(0.2, timeout_s / 2),
            )
        except Exception:
            head = None
        return ReadinessMigrationsCheck(status="error", current=None, head=head)


def _aggregate_status(
    db: ReadinessCheckDatabase,
    redis: ReadinessCheckRedis,
    migrations: ReadinessMigrationsCheck,
) -> str:
    if db.status == "error" or redis.status == "error":
        return "not_ready"
    if migrations.status == "error":
        return "not_ready"
    if migrations.status == "pending":
        return "degraded"
    return "ready"


async def _compute_readiness() -> ReadinessResponse:
    t0 = time.monotonic()

    database_coro = _check_database(DB_CHECK_TIMEOUT_S)
    redis_coro = _check_redis(REDIS_CHECK_TIMEOUT_S)
    database, redis = await asyncio.gather(database_coro, redis_coro)

    elapsed = time.monotonic() - t0
    migration_timeout = max(0.25, READY_OUTER_TIMEOUT_S - elapsed - 0.05)
    ini = resolve_alembic_ini_path()
    migrations = await _check_migrations(ini, migration_timeout)

    checks = ReadinessChecks(database=database, redis=redis, migrations=migrations)
    overall = _aggregate_status(database, redis, migrations)
    return ReadinessResponse(status=overall, checks=checks, timestamp=utc_timestamp_z())


async def run_readiness_checks() -> ReadinessResponse:
    """
    Run all readiness probes within roughly 5 seconds (per-check timeouts + migration budget).

    A final ``asyncio.wait_for`` enforces a hard wall-clock cap (partial result on overrun).

    Returns a structured payload (HTTP layer maps non-ready statuses to 503).
    """
    try:
        return await asyncio.wait_for(_compute_readiness(), timeout=READY_OUTER_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.error("Readiness wall-clock timeout after %.1fs", READY_OUTER_TIMEOUT_S)
        return ReadinessResponse(
            status="not_ready",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="error", latency_ms=None),
                redis=ReadinessCheckRedis(status="error", latency_ms=None),
                migrations=ReadinessMigrationsCheck(status="error", current=None, head=None),
            ),
            timestamp=utc_timestamp_z(),
        )
