"""
System endpoints (service health/version), no user data.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="System health check", operation_id="system_health_check")
async def system_health():
    return {"status": "healthy"}


@router.get("/version", summary="Service version", operation_id="system_version")
async def system_version():
    return {"name": "FitTracker Pro API", "version": "1.0.0"}
