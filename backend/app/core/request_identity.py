"""
Extract caller identity from the HTTP request (no DB), for logging and Sentry.
"""
from __future__ import annotations

from starlette.requests import Request

from app.core.security import verify_token


def user_id_from_authorization_header(request: Request) -> int | None:
    """Return JWT access `sub` when a valid Bearer access token is present."""
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    return verify_token(token)
