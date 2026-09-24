"""
Health check service for dependency-aware readiness checks.
Implements:
- /health/live → liveness (app is running)
- /health/ready → readiness (all dependencies are healthy)
"""

from __future__ import annotations

from datetime import datetime

from app.core.health import run_readiness_checks
from app.schemas.system import LivenessResponse, ReadinessResponse


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
        Readiness probe: PostgreSQL ``SELECT 1`` and Redis ``PING`` (each with a 2s timeout).
        Used by load balancers to route traffic only to ready instances.
        """
        return await run_readiness_checks()
