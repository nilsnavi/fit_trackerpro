"""Shared FastAPI dependencies (guards) for HTTP API layers."""

from app.api.deps.auth import (
    ROUTER_DEPENDENCIES_AUTHENTICATED,
    get_current_active_user,
    get_current_user,
    get_current_user_id,
    require_admin,
)

__all__ = [
    "ROUTER_DEPENDENCIES_AUTHENTICATED",
    "get_current_active_user",
    "get_current_user",
    "get_current_user_id",
    "require_admin",
]
