"""
JWT and user resolution dependencies.

``ROUTER_DEPENDENCIES_AUTHENTICATED`` is the router/mount-level guard for subtrees
that require a valid Bearer access token and a matching user row. Endpoints that
need the ``User`` instance must still declare ``current_user: User = Depends(get_current_user)``;
FastAPI caches identical dependencies once per request.
"""
from __future__ import annotations

from fastapi import Depends

from app.middleware.auth import (
    get_current_active_user,
    get_current_user,
    get_current_user_id,
    require_admin,
)

ROUTER_DEPENDENCIES_AUTHENTICATED = [Depends(get_current_user)]

__all__ = [
    "ROUTER_DEPENDENCIES_AUTHENTICATED",
    "get_current_active_user",
    "get_current_user",
    "get_current_user_id",
    "require_admin",
]
