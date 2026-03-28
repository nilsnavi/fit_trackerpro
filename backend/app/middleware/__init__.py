"""
FitTracker Pro Middleware
Custom middleware for authentication, rate limiting, and logging
"""

from app.core.security import (
    JWTBearer,
    create_access_token,
    create_refresh_token,
    verify_token,
)

from .auth import (
    get_current_active_user,
    get_current_user,
    get_current_user_id,
    require_admin,
)

from .rate_limit import (
    RateLimitConfig,
    RateLimitMiddleware,
    rate_limit,
)

__all__ = [
    # Auth
    "get_current_user",
    "get_current_user_id",
    "get_current_active_user",
    "require_admin",
    "JWTBearer",
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    # Rate Limit
    "RateLimitMiddleware",
    "rate_limit",
    "RateLimitConfig",
]
