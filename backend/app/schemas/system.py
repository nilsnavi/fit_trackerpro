"""Schemas for public system endpoints (health, version)."""

from pydantic import BaseModel


class HealthCheckResponse(BaseModel):
    status: str


class ServiceVersionResponse(BaseModel):
    name: str
    version: str
