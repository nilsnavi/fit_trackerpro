"""
Request / correlation ID: single canonical ID for tracing, async-safe context, response headers.

Incoming priority: ``X-Correlation-ID`` (distributed tracing), then ``X-Request-ID``, then UUID.
Both ``X-Request-ID`` and ``X-Correlation-ID`` are set on the response to the same value.
"""
from __future__ import annotations

import re
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging.context import request_id_var

_MAX_ID_LEN = 128
# UUID, ULID-ish, simple slugs; reject control chars and spaces.
_ID_SAFE = re.compile(r"^[A-Za-z0-9._\-]+$")


def _parse_incoming_id(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if not s or len(s) > _MAX_ID_LEN:
        return None
    if not _ID_SAFE.match(s):
        return None
    return s


def incoming_correlation_id(request: Request) -> str | None:
    return _parse_incoming_id(
        request.headers.get("x-correlation-id") or request.headers.get("X-Correlation-ID")
    )


def incoming_request_id_header(request: Request) -> str | None:
    return _parse_incoming_id(
        request.headers.get("x-request-id") or request.headers.get("X-Request-ID")
    )


def resolve_request_correlation_id(request: Request) -> str:
    """Prefer correlation id for cross-service tracing, then client request id, else UUID."""
    return (
        incoming_correlation_id(request)
        or incoming_request_id_header(request)
        or str(uuid.uuid4())
    )


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Outermost-friendly: sets contextvars and response headers before inner middleware runs."""

    async def dispatch(self, request: Request, call_next) -> Response:
        canonical = resolve_request_correlation_id(request)
        token = request_id_var.set(canonical)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = canonical
            response.headers["X-Correlation-ID"] = canonical
            return response
        finally:
            request_id_var.reset(token)
