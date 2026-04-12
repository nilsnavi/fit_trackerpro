"""Schemas for public system endpoints (health, version)."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class HealthStatus(StrEnum):
    """Values returned by ``SystemService.health_check`` and probes."""

    HEALTHY = "healthy"
    OK = "ok"
    DEGRADED = "degraded"


class HealthCheckResponse(BaseModel):
    status: HealthStatus = Field(
        ...,
        description="Overall process health indicator.",
    )


class LivenessResponse(BaseModel):
    """Liveness probe response: container is running."""

    status: str = Field(
        "alive",
        description="Always 'alive' if endpoint responds",
    )
    timestamp: str = Field(..., description="UTC ISO8601 timestamp")


class ReadinessChecks(BaseModel):
    """Per-dependency result: ``\"ok\"`` or ``\"error: …\"`` (human-readable failure)."""

    database: str = Field(
        ...,
        description='``"ok"`` or ``"error: …"`` from PostgreSQL ``SELECT 1``.',
    )
    redis: str = Field(
        ...,
        description='``"ok"`` or ``"error: …"`` from Redis ``PING``.',
    )


class ReadinessResponse(BaseModel):
    """Readiness probe: PostgreSQL (async session) and Redis (shared async client)."""

    status: Literal["ready", "not_ready"] = Field(
        ...,
        description="'ready' only if both checks are ok; otherwise 'not_ready'.",
    )
    checks: ReadinessChecks = Field(...)


class ServiceVersionResponse(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    version: str = Field(..., min_length=1, max_length=64)
    commit_sha: str | None = Field(
        default=None,
        max_length=64,
    )
    build_timestamp: str | None = Field(
        default=None,
        max_length=64,
    )
