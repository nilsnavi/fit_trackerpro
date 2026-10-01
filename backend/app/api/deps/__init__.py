"""Shared FastAPI dependencies (guards) for HTTP API layers."""

from app.api.deps.auth import (
    ROUTER_DEPENDENCIES_AUTHENTICATED,
    get_current_active_user,
    get_current_user,
    get_current_user_id,
    require_admin,
)
from app.api.deps.coach import require_active_coach_client, require_coach, require_coach_feature

__all__ = [
    "ROUTER_DEPENDENCIES_AUTHENTICATED",
    "get_current_active_user",
    "get_current_user",
    "get_current_user_id",
    "require_admin",
    "require_active_coach_client",
    "require_coach",
    "require_coach_feature",
]
