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


class ReadinessCheckDatabase(BaseModel):
    status: Literal["ok", "error"] = Field(...)
    latency_ms: Optional[float] = Field(
        default=None,
        description="Round-trip time in milliseconds (best-effort on errors).",
    )


class ReadinessCheckRedis(BaseModel):
    status: Literal["ok", "error"] = Field(...)
    latency_ms: Optional[float] = Field(
        default=None,
        description="Round-trip time in milliseconds (best-effort on errors).",
    )


class ReadinessMigrationsCheck(BaseModel):
    status: Literal["ok", "pending", "error"] = Field(...)
    current: Optional[str] = Field(default=None, description="Revision in alembic_version")
    head: Optional[str] = Field(default=None, description="Alembic head revision from scripts")


class ReadinessChecks(BaseModel):
    database: ReadinessCheckDatabase
    redis: ReadinessCheckRedis
    migrations: ReadinessMigrationsCheck


class ReadinessResponse(BaseModel):
    """Readiness probe: PostgreSQL, Redis, and Alembic migration alignment."""

    status: Literal["ready", "degraded", "not_ready"] = Field(
        ...,
        description="'ready' if DB/Redis OK and migrations match head; "
        "'degraded' if DB/Redis OK but migrations pending; "
        "'not_ready' on dependency failures.",
    )
    checks: ReadinessChecks = Field(...)
    timestamp: str = Field(..., description="UTC ISO8601 timestamp with Z suffix")


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
