"""HTTP handlers for rate-limit exceptions (SlowAPI)."""
from __future__ import annotations

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from starlette.responses import Response


def slowapi_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    429 + ``Retry-After`` without ``Limiter(headers_enabled=True)`` (that mode breaks
    normal FastAPI return values, which are not yet ``Response`` instances).
    """
    response = _rate_limit_exceeded_handler(request, exc)
    if response.headers.get("Retry-After") is None and response.headers.get("retry-after") is None:
        # Telegram login uses a 1-minute window; use a safe upper bound for clients.
        response.headers["Retry-After"] = "60"
    return response
