"""
HTTP access logging: request-id, user-id, route, duration, status.

Request / correlation ID is set by ``RequestCorrelationMiddleware`` (outermost).
"""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging.context import request_id_var, user_id_var
from app.core.request_identity import user_id_from_authorization_header

logger = logging.getLogger("app.http")


def _matched_route_template(request: Request) -> str | None:
    route = request.scope.get("route")
    if route is None:
        return None
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    return None


class StructuredRequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Binds ``user_id`` for application logs; logs one structured line per request.

    ``request_id`` / correlation comes from ``RequestCorrelationMiddleware`` via contextvars.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        user_id = user_id_from_authorization_header(request)
        uid_token = user_id_var.set(user_id)

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 3)
            route = _matched_route_template(request)
            path = request.url.path
            request_id = request_id_var.get()
            logger.info(
                "http_request",
                extra={
                    "event": "http_request",
                    "request_id": request_id,
                    "user_id": user_id,
                    "route": route or path,
                    "path": path,
                    "method": request.method,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
            )
            user_id_var.reset(uid_token)
