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

from app.core.logging.context import (
    client_ip_var,
    method_var,
    path_var,
    request_id_var,
    route_var,
    user_agent_var,
    user_id_var,
)
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


def _client_ip(request: Request) -> str | None:
    # Prefer X-Forwarded-For (left-most = original client) when behind reverse proxy.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    if request.client is None:
        return None
    return request.client.host


class StructuredRequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Binds ``user_id`` for application logs; logs one structured line per request.

    ``request_id`` / correlation comes from ``RequestCorrelationMiddleware`` via contextvars.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        user_id = user_id_from_authorization_header(request)
        uid_token = user_id_var.set(user_id)

        path = request.url.path
        route = _matched_route_template(request) or path
        ip = _client_ip(request)
        ua = request.headers.get("user-agent")

        t_route = route_var.set(route)
        t_path = path_var.set(path)
        t_method = method_var.set(request.method)
        t_ip = client_ip_var.set(ip)
        t_ua = user_agent_var.set(ua)

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 3)
            request_id = request_id_var.get()
            logger.info(
                "http_request",
                extra={
                    "event": "http_request",
                    "request_id": request_id,
                    "user_id": user_id,
                    "route": route,
                    "path": path,
                    "method": request.method,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "client_ip": ip,
                    "user_agent": ua,
                },
            )
            user_agent_var.reset(t_ua)
            client_ip_var.reset(t_ip)
            method_var.reset(t_method)
            path_var.reset(t_path)
            route_var.reset(t_route)
            user_id_var.reset(uid_token)
