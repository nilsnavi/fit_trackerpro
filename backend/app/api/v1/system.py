"""
System endpoints (service health/version), no user data.
"""
from fastapi import APIRouter

from app.settings import settings
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
    summary="Service version and build metadata",
    operation_id="system_version",
)
async def system_version():
    return ServiceVersionResponse(
        name=f"{settings.APP_NAME} API",
        version=settings.APP_VERSION,
        commit_sha=settings.GIT_COMMIT_SHA,
        build_timestamp=settings.BUILD_TIMESTAMP,
    )
