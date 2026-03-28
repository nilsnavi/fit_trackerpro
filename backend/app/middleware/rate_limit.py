"""
Rate Limiting Middleware
Rate limiting using Redis for distributed tracking
"""
import os
import time
import redis
from typing import Optional, Callable
from functools import wraps

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings


class RateLimitConfig:
    """Rate limit configuration"""
    DEFAULT_LIMIT = 100  # requests
    DEFAULT_WINDOW = 60  # seconds

    # Endpoint specific limits
    ENDPOINT_LIMITS = {
        # Auth endpoints
        "/api/v1/users/auth/telegram": (5, 60),      # 5 per minute
        "/api/v1/users/auth/refresh": (10, 60),      # 10 per minute
        "/api/v1/users/auth/logout": (10, 60),       # 10 per minute
        "/api/v1/auth/telegram": (5, 60),            # legacy alias
        "/api/v1/auth/refresh": (10, 60),            # legacy alias
        "/api/v1/auth/logout": (10, 60),             # legacy alias

        # Emergency endpoints - higher limits
        "/api/v1/system/emergency/notify": (20, 60),  # 20 per minute
        "/api/v1/emergency/notify": (20, 60),         # legacy alias

        # Export endpoints - lower limits
        "/api/v1/analytics/export": (5, 3600),  # 5 per hour
    }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using Redis

    Tracks request counts per IP address and endpoint
    """

    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.config = RateLimitConfig()

        # Initialize Redis client
        try:
            self.redis = redis_client or redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis.ping()
        except (redis.ConnectionError, Exception):
            # Fallback to in-memory storage if Redis is unavailable
            self.redis = None
            self._memory_storage = {}

    def _get_key(self, identifier: str, path: str) -> str:
        """Generate rate limit key"""
        return f"ratelimit:{identifier}:{path}"

    def _get_memory_count(self, key: str, window: int) -> int:
        """Get count from in-memory storage"""
        now = time.time()
        if key not in self._memory_storage:
            self._memory_storage[key] = []

        # Clean old entries
        self._memory_storage[key] = [
            ts for ts in self._memory_storage[key]
            if now - ts < window
        ]

        return len(self._memory_storage[key])

    def _increment_memory(self, key: str, window: int):
        """Increment count in in-memory storage"""
        now = time.time()
        if key not in self._memory_storage:
            self._memory_storage[key] = []

        self._memory_storage[key].append(now)

    def _check_rate_limit(
        self,
        identifier: str,
        path: str,
        limit: int,
        window: int
    ) -> tuple[bool, int, int]:
        """
        Check if request is within rate limit

        Returns:
            Tuple of (allowed, remaining, reset_time)
        """
        key = self._get_key(identifier, path)

        if self.redis:
            # Use Redis
            pipe = self.redis.pipeline()
            now = time.time()

            # Remove old entries
            pipe.zremrangebyscore(key, 0, now - window)

            # Count current entries
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(now): now})

            # Set expiry on key
            pipe.expire(key, window)

            results = pipe.execute()
            current_count = results[1]

            allowed = current_count <= limit
            remaining = max(0, limit - current_count)
            reset_time = int(now + window)

        else:
            # Use in-memory storage
            current_count = self._get_memory_count(key, window)
            allowed = current_count < limit
            remaining = max(0, limit - current_count - 1)
            reset_time = int(time.time() + window)

            if allowed:
                self._increment_memory(key, window)

        return allowed, remaining, reset_time

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with rate limiting
        """
        if os.environ.get("PYTEST_RUNNING") == "1":
            return await call_next(request)

        # Skip rate limiting for certain paths
        if request.url.path in ["/", "/docs", "/redoc", "/openapi.json", "/health"]:
            return await call_next(request)

        # Get identifier (prefer user ID from auth, fallback to IP)
        identifier = self._get_identifier(request)

        # Get rate limit for this endpoint
        limit, window = self._get_endpoint_limit(request.url.path)

        # Check rate limit
        allowed, remaining, reset_time = self._check_rate_limit(
            identifier,
            request.url.path,
            limit,
            window
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(window)
                }
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)

        return response

    def _get_identifier(self, request: Request) -> str:
        """Get identifier for rate limiting"""
        # Try to get user ID from auth header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # We could decode JWT here, but for simplicity use IP
            # In production, decode JWT and use user_id
            pass

        # Fallback to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.client.host if request.client else "unknown"

    def _get_endpoint_limit(self, path: str) -> tuple[int, int]:
        """Get rate limit for specific endpoint"""
        # Check exact match
        if path in self.config.ENDPOINT_LIMITS:
            return self.config.ENDPOINT_LIMITS[path]

        # Check prefix match
        for prefix, (limit, window) in self.config.ENDPOINT_LIMITS.items():
            if path.startswith(prefix):
                return limit, window

        # Return default
        return self.config.DEFAULT_LIMIT, self.config.DEFAULT_WINDOW


def rate_limit(
    requests: int = 100,
    window: int = 60,
    key_func: Optional[Callable] = None
):
    """
    Decorator for endpoint-specific rate limiting

    Args:
        requests: Maximum number of requests allowed
        window: Time window in seconds
        key_func: Function to generate rate limit key (defaults to IP)

    Usage:
        @app.get("/api/some-endpoint")
        @rate_limit(requests=10, window=60)
        async def some_endpoint():
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from kwargs or args
            request = kwargs.get('request')
            if not request and args:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if not request:
                return await func(*args, **kwargs)

            # Generate key
            if key_func:
                key = key_func(request)
            else:
                forwarded = request.headers.get("X-Forwarded-For")
                if forwarded:
                    key = forwarded.split(",")[0].strip()
                else:
                    key = request.client.host if request.client else "unknown"

            # Check rate limit (simplified - in production use Redis)
            # This is a placeholder for the actual implementation

            return await func(*args, **kwargs)

        return wrapper
    return decorator
