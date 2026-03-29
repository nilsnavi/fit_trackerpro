"""Schemas for public system endpoints (health, version)."""

from __future__ import annotations

from enum import StrEnum

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
