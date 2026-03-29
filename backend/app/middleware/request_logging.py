"""
HTTP access logging: request-id, user-id, route, duration, status.
"""
from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging.context import request_id_var, user_id_var
from app.core.request_identity import user_id_from_authorization_header

logger = logging.getLogger("app.http")


def _incoming_request_id(request: Request) -> str | None:
    raw = request.headers.get("x-request-id") or request.headers.get("X-Request-ID")
    if not raw:
        return None
    s = raw.strip()
    return s or None


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
    Outermost-friendly middleware: full wall time, propagates X-Request-ID,
    binds request_id / user_id for application logs via logging.Filter.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = _incoming_request_id(request) or str(uuid.uuid4())
        user_id = user_id_from_authorization_header(request)

        rid_token = request_id_var.set(request_id)
        uid_token = user_id_var.set(user_id)

        start = time.perf_counter()
        status_code = 500
        response: Response | None = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 3)
            route = _matched_route_template(request)
            path = request.url.path
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
            request_id_var.reset(rid_token)
            user_id_var.reset(uid_token)
