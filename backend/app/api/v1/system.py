"""
System endpoints (service health/version), no user data.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.application.health_check_service import HealthCheckService
from app.application.system_service import SystemService
from app.schemas.system import (
    HealthCheckResponse,
    LivenessResponse,
    ReadinessResponse,
    ServiceVersionResponse,
)

router = APIRouter()


def health_check_response() -> HealthCheckResponse:
    """Canonical liveness payload for GET /api/v1/system/health and GET /health."""
    return SystemService.health_check()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="System health check (legacy)",
    operation_id="system_health_check",
)
async def system_health():
    return SystemService.health_check()


@router.get(
    "/live",
    response_model=LivenessResponse,
    summary="Liveness probe (container is running)",
    operation_id="liveness_probe",
    tags=["System"],
)
async def liveness_probe():
    """
    Liveness probe for container orchestration.
    Returns 200 if the application process is running.
    Used by Docker/Kubernetes to determine if container should be restarted.
    """
    return await HealthCheckService.liveness()


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe (PostgreSQL, Redis, Alembic)",
    operation_id="readiness_probe",
    tags=["System"],
)
async def readiness_probe():
    """
    Readiness probe for load balancers and orchestrators.
    Проверяет PostgreSQL (SELECT 1), Redis (PING) и соответствие ревизии Alembic в БД head-ревизии.

    HTTP 200 только при ``status == "ready"``; ``degraded`` / ``not_ready`` → 503.
    """
    readiness = await HealthCheckService.readiness()
    if readiness.status != "ready":
        return JSONResponse(status_code=503, content=readiness.model_dump())
    return readiness


@router.get(
    "/version",
    response_model=ServiceVersionResponse,
    summary="Service version and build metadata",
    operation_id="system_version",
)
async def system_version():
    return SystemService.get_version()
