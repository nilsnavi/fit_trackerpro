"""
SlowAPI limiter for per-route ``@limiter.limit`` decorators.

Prefix-scoped tiers (workouts, analytics, etc.) stay in ``RateLimitMiddleware`` (Redis / memory).
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory per process. Keep ``headers_enabled=False`` so successful JSON responses
# are not wrapped before SlowAPI header injection (see ``rate_limit_handlers`` for 429).
limiter = Limiter(key_func=get_remote_address, headers_enabled=False)
