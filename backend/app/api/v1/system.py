"""
System endpoints (service health/version), no user data.
"""
from fastapi import APIRouter

from app.schemas.system import HealthCheckResponse, ServiceVersionResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="System health check",
    operation_id="system_health_check",
)
async def system_health():
    return HealthCheckResponse(status="healthy")


@router.get(
    "/version",
    response_model=ServiceVersionResponse,
    summary="Service version",
    operation_id="system_version",
)
async def system_version():
    return ServiceVersionResponse(name="FitTracker Pro API", version="1.0.0")
