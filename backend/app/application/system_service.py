"""System health and version (no user data)."""

from __future__ import annotations

from app.schemas.system import HealthCheckResponse, ServiceVersionResponse
from app.settings import settings


class SystemService:
    @staticmethod
    def health_check() -> HealthCheckResponse:
        return HealthCheckResponse(status="healthy")

    @staticmethod
    def get_version() -> ServiceVersionResponse:
        return ServiceVersionResponse(
            name=f"{settings.APP_NAME} API",
            version=settings.APP_VERSION,
            commit_sha=settings.GIT_COMMIT_SHA,
            build_timestamp=settings.BUILD_TIMESTAMP,
        )
