"""Schemas for public system endpoints (health, version)."""

from __future__ import annotations

from enum import StrEnum
from typing import Optional

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


class DependencyStatus(BaseModel):
    """Status of a single dependency (database, Redis, etc)."""

    name: str = Field(..., description="Dependency name")
    healthy: bool = Field(..., description="Is dependency healthy")
    response_time_ms: Optional[float] = Field(
        default=None,
        description="Response time in milliseconds",
    )
    message: Optional[str] = Field(
        default=None,
        description="Additional status message or error",
    )


class LivenessResponse(BaseModel):
    """Liveness probe response: container is running."""

    status: str = Field(
        "alive",
        description="Always 'alive' if endpoint responds",
    )
    timestamp: str = Field(..., description="UTC ISO8601 timestamp")


class ReadinessResponse(BaseModel):
    """Readiness probe response: dependencies are healthy."""

    status: str = Field(
        ...,
        description="'ready' if all dependencies are healthy, 'not_ready' otherwise",
    )
    timestamp: str = Field(..., description="UTC ISO8601 timestamp")
    dependencies: dict[str, DependencyStatus] = Field(
        ...,
        description="Status of each checked dependency",
    )


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
