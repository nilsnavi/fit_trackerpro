"""
Baseline HTTP security headers for API responses (JSON / webhooks).

Framing policy: API must not be embedded in third-party frames (DENY). The SPA is
served separately (nginx); Telegram Mini App framing is configured there via
``frame-ancestors``, not here.
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Restrictive defaults; relax only if a feature explicitly requires more.
_PERMISSIONS_POLICY = (
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
    "magnetometer=(), microphone=(), payment=(), usb=()"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", _PERMISSIONS_POLICY)
        return response
