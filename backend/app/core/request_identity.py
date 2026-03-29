"""
Extract caller identity from the HTTP request (no DB), for logging and Sentry.
"""
from __future__ import annotations

import json
import logging

from starlette.requests import Request

from app.core.security import verify_token
from app.infrastructure.telegram_auth import validate_and_get_user

logger = logging.getLogger(__name__)


def user_id_from_authorization_header(request: Request) -> int | None:
    """Return JWT access `sub` when a valid Bearer access token is present."""
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    return verify_token(token)


def path_needs_body_for_rate_limit_identity(path: str, method: str) -> bool:
    """Whether we must read the body to resolve a per-user rate limit key."""
    if method.upper() != "POST":
        return False
    if path.endswith("/auth/refresh"):
        return True
    if path.endswith("/telegram") and "/auth/" in path:
        return True
    return False


def telegram_user_id_from_body_for_rate_limit(path: str, method: str, body: bytes) -> int | None:
    """
    Telegram user id for rate limiting from JSON body (refresh JWT or validated WebApp initData).

    Invalid or unsigned payloads return None so the caller falls back to IP-based limiting.
    """
    if not body or not path_needs_body_for_rate_limit_identity(path, method):
        return None
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None

    if path.endswith("/auth/refresh"):
        token = data.get("refresh_token")
        if not token or not isinstance(token, str):
            return None
        return verify_token(token, token_type="refresh")

    if path.endswith("/telegram") and "/auth/" in path:
        init_data = data.get("init_data")
        if not init_data or not isinstance(init_data, str):
            return None
        try:
            is_valid, user_data, _ = validate_and_get_user(init_data)
        except Exception as e:
            logger.debug("initData validation for rate limit: %s", e)
            return None
        if not is_valid or not user_data:
            return None
        uid = user_data.get("id")
        if uid is None:
            return None
        try:
            return int(uid)
        except (TypeError, ValueError):
            return None

    return None
