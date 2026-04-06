"""
Sentry request scope: attach authenticated user (JWT `sub` / telegram_id) without a DB round-trip.
"""
from __future__ import annotations

import sentry_sdk
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.request_identity import user_id_from_authorization_header
from app.settings import settings


class SentryUserContextMiddleware(BaseHTTPMiddleware):
    """Sets Sentry user for the current request when a valid Bearer token is present."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.SENTRY_DSN:
            return await call_next(request)

        user_id = user_id_from_authorization_header(request)
        with sentry_sdk.configure_scope() as scope:
            scope.set_user({"id": str(user_id)} if user_id is not None else None)
            return await call_next(request)
