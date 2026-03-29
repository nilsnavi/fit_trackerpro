"""
Central registration of all HTTP API v1 routers: one canonical tree under ``/api/v1``
and explicit legacy alias mounts for backward compatibility.

Prefixes here are the *suffix* after ``/api/v1`` (no version string in each line).

Auth boundary:
  * **Public / system** — no ``Authorization`` header (``/system/*``, auth login/refresh,
    user create, public user by id).
  * **Authenticated** — valid Bearer access token; enforced at mount via
    ``ROUTER_DEPENDENCIES_AUTHENTICATED`` plus per-route ``Depends(get_current_user)`` where
    handlers need the ``User`` model.
"""
from __future__ import annotations

from fastapi import APIRouter, FastAPI

from app.api.deps.auth import ROUTER_DEPENDENCIES_AUTHENTICATED
from app.api.v1.achievements import router as achievements_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import protected_auth_router, public_auth_router
from app.api.v1.challenges import router as challenges_router
from app.api.v1.emergency import router as emergency_router
from app.api.v1.exercises import router as exercises_router
from app.api.v1.health_metrics import router as health_metrics_router
from app.api.v1.system import router as system_router
from app.api.v1.users import protected_users_router, public_users_router
from app.api.v1.workouts import router as workouts_router
from app.api.v1.openapi_tags import (
    TAG_ACHIEVEMENTS,
    TAG_ANALYTICS,
    TAG_AUTHENTICATION,
    TAG_CHALLENGES,
    TAG_EMERGENCY,
    TAG_EXERCISES,
    TAG_HEALTH_METRICS,
    TAG_SYSTEM,
    TAG_USERS,
    TAG_WORKOUTS,
)

# Public so tests, docs, or tooling can assert the mounted API version prefix.
API_V1_PREFIX = "/api/v1"


def register_v1_routes(app: FastAPI) -> None:
    """Mount version 1 API: canonical paths under ``API_V1_PREFIX`` plus deprecated aliases."""
    api_v1 = APIRouter(prefix=API_V1_PREFIX)

    # --- Public / system (no JWT) ---
    api_v1.include_router(system_router, prefix="/system", tags=[TAG_SYSTEM])
    api_v1.include_router(public_auth_router, prefix="/users/auth", tags=[TAG_AUTHENTICATION])

    # --- Authenticated (Bearer access token) ---
    auth_mount_kw = {"dependencies": ROUTER_DEPENDENCIES_AUTHENTICATED}
    api_v1.include_router(
        protected_auth_router,
        prefix="/users/auth",
        tags=[TAG_AUTHENTICATION],
        **auth_mount_kw,
    )
    api_v1.include_router(
        protected_users_router,
        prefix="/users",
        tags=[TAG_USERS],
        **auth_mount_kw,
    )
    # After ``/users/me`` so ``GET /users/{user_id}`` does not consume the ``me`` segment (422).
    api_v1.include_router(public_users_router, prefix="/users", tags=[TAG_USERS])
    api_v1.include_router(workouts_router, prefix="/workouts", tags=[TAG_WORKOUTS], **auth_mount_kw)
    api_v1.include_router(exercises_router, prefix="/exercises", tags=[TAG_EXERCISES], **auth_mount_kw)
    api_v1.include_router(
        health_metrics_router,
        prefix="/health-metrics",
        tags=[TAG_HEALTH_METRICS],
        **auth_mount_kw,
    )
    api_v1.include_router(analytics_router, prefix="/analytics", tags=[TAG_ANALYTICS], **auth_mount_kw)
    api_v1.include_router(
        achievements_router,
        prefix="/analytics/achievements",
        tags=[TAG_ACHIEVEMENTS],
        **auth_mount_kw,
    )
    api_v1.include_router(
        challenges_router,
        prefix="/analytics/challenges",
        tags=[TAG_CHALLENGES],
        **auth_mount_kw,
    )
    api_v1.include_router(
        emergency_router,
        prefix="/system/emergency",
        tags=[TAG_EMERGENCY],
        **auth_mount_kw,
    )

    app.include_router(api_v1)

    legacy = APIRouter()
    legacy.include_router(public_auth_router, prefix="/auth", tags=[TAG_AUTHENTICATION])
    legacy.include_router(
        protected_auth_router,
        prefix="/auth",
        tags=[TAG_AUTHENTICATION],
        **auth_mount_kw,
    )
    legacy.include_router(achievements_router, prefix="/achievements", tags=[TAG_ACHIEVEMENTS], **auth_mount_kw)
    legacy.include_router(challenges_router, prefix="/challenges", tags=[TAG_CHALLENGES], **auth_mount_kw)
    legacy.include_router(
        emergency_router,
        prefix="/emergency",
        tags=[TAG_EMERGENCY],
        **auth_mount_kw,
    )
    app.include_router(legacy, prefix=API_V1_PREFIX, deprecated=True)
