"""Schemas for public system endpoints (health, version)."""

from pydantic import BaseModel


class HealthCheckResponse(BaseModel):
    status: str


class ServiceVersionResponse(BaseModel):
    name: str
    version: str
    commit_sha: str | None = None
    build_timestamp: str | None = None
