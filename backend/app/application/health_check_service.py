"""Dependency-aware liveness and readiness checks."""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.health import run_readiness_checks
from app.schemas.system import LivenessResponse, ReadinessResponse


class HealthCheckService:
    """Expose health checks to HTTP handlers without duplicating probe logic."""

    @staticmethod
    async def liveness() -> LivenessResponse:
        """Return process liveness without checking external dependencies."""
        return LivenessResponse(
            status="alive",
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        )

    @staticmethod
    async def readiness() -> ReadinessResponse:
        """Check PostgreSQL, Redis, and the expected Alembic migration head."""
        return await run_readiness_checks()
