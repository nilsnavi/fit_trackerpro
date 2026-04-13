"""
SlowAPI limiter for per-route ``@limiter.limit`` decorators.

Prefix-scoped tiers (workouts, analytics, etc.) stay in ``RateLimitMiddleware`` (Redis / memory).
"""
from __future__ import annotations

import os
import uuid

from slowapi import Limiter
from slowapi.util import get_remote_address


def _slowapi_key_func(request) -> str:
    """
    In production we rate-limit by client IP.

    In tests, the suite performs many auth requests quickly and would trip the 10/min limit.
    We disable SlowAPI limiting by default under PYTEST, while keeping the behavior testable
    by opting-in per request using a dedicated header.
    """
    if os.environ.get("PYTEST_RUNNING") == "1" and request.headers.get("X-SlowAPI-Test") != "1":
        return f"pytest:{uuid.uuid4()}"
    return get_remote_address(request)

# In-memory per process. Keep ``headers_enabled=False`` so successful JSON responses
# are not wrapped before SlowAPI header injection (see ``rate_limit_handlers`` for 429).
limiter = Limiter(key_func=_slowapi_key_func, headers_enabled=False)
