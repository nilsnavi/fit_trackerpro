"""
System endpoints (service health/version), no user data.
"""
from fastapi import APIRouter

from app.application.system_service import SystemService
from app.schemas.system import HealthCheckResponse, ServiceVersionResponse

router = APIRouter()


def health_check_response() -> HealthCheckResponse:
    """Canonical liveness payload for GET /api/v1/system/health and GET /health."""
    return SystemService.health_check()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="System health check",
    operation_id="system_health_check",
)
async def system_health():
    return SystemService.health_check()


@router.get(
    "/version",
    response_model=ServiceVersionResponse,
    summary="Service version and build metadata",
    operation_id="system_version",
)
async def system_version():
    return SystemService.get_version()
