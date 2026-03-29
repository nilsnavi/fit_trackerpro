"""
Rate Limiting Middleware
Rate limiting using Redis for distributed tracking
"""
import logging
import os
import time
import redis
from functools import wraps
from typing import Callable, Optional

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api.v1.registration import API_V1_PREFIX
from app.core.request_identity import (
    path_needs_body_for_rate_limit_identity,
    telegram_user_id_from_body_for_rate_limit,
    user_id_from_authorization_header,
)
from app.settings import settings

logger = logging.getLogger(__name__)

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Policy tokens exposed in X-RateLimit-Policy (stable for clients)
POLICY_DEFAULT = "default"
POLICY_AUTH = "auth"
POLICY_AUTH_STRICT = "auth-strict"
POLICY_SYSTEM = "system"
POLICY_WRITE = "write"
POLICY_EXPORT = "export"
POLICY_EMERGENCY_NOTIFY = "emergency-notify"


def create_rate_limit_redis_client() -> Optional[redis.Redis]:
    """
    Create a synchronous Redis client for rate limiting.
    Returns None if Redis is unavailable (middleware falls back to in-memory).
    Caller must close the client on application shutdown.
    """
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except (redis.ConnectionError, redis.TimeoutError, OSError) as e:
        logger.warning("Redis unavailable for rate limiting, using in-memory: %s", e)
        return None
    except Exception as e:
        logger.warning("Redis rate-limit init failed, using in-memory: %s", e)
        return None


def close_rate_limit_redis_client(client: Optional[redis.Redis]) -> None:
    if client is not None:
        client.close()


def _apply_rate_limit_headers(
    headers: dict[str, str],
    *,
    limit: int,
    remaining: int,
    reset_time: int,
    window: int,
    policy: str,
) -> None:
    """Populate predictable, documented response headers (also used on 429)."""
    slimit = str(limit)
    srem = str(remaining)
    sreset = str(reset_time)
    swin = str(window)
    headers["X-RateLimit-Limit"] = slimit
    headers["X-RateLimit-Remaining"] = srem
    headers["X-RateLimit-Reset"] = sreset
    headers["X-RateLimit-Window"] = swin
    headers["X-RateLimit-Policy"] = policy
    # Draft / common convention mirror (same semantics as X-RateLimit-*)
    headers["RateLimit-Limit"] = slimit
    headers["RateLimit-Remaining"] = srem
    headers["RateLimit-Reset"] = sreset


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using Redis

    Counts requests per policy and path. The key is a valid JWT ``sub`` (Telegram user id)
    when present, else Telegram user id from validated initData / refresh token body on auth
    routes, else client IP (or ``X-Forwarded-For`` first hop).
    """

    def __init__(self, app):
        super().__init__(app)
        self._memory_storage: dict = {}

    def _get_key(self, identifier: str, policy: str, path: str) -> str:
        """Include policy so read vs write tiers do not share one counter on the same path."""
        return f"ratelimit:{identifier}:{policy}:{path}"

    def _get_memory_count(self, key: str, window: int) -> int:
        """Get count from in-memory storage"""
        now = time.time()
        if key not in self._memory_storage:
            self._memory_storage[key] = []

        self._memory_storage[key] = [
            ts for ts in self._memory_storage[key] if now - ts < window
        ]

        return len(self._memory_storage[key])

    def _increment_memory(self, key: str, window: int) -> None:
        """Increment count in in-memory storage"""
        now = time.time()
        if key not in self._memory_storage:
            self._memory_storage[key] = []

        self._memory_storage[key].append(now)

    def _check_rate_limit(
        self,
        identifier: str,
        policy: str,
        path: str,
        limit: int,
        window: int,
        redis_client: Optional[redis.Redis],
    ) -> tuple[bool, int, int]:
        """
        Check if request is within rate limit.

        Returns:
            Tuple of (allowed, remaining, reset_epoch_seconds)
        """
        key = self._get_key(identifier, policy, path)

        if redis_client:
            now = time.time()
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zcard(key)
            current_count = pipe.execute()[1]

            allowed = current_count < limit
            if allowed:
                redis_client.zadd(key, {str(now): now})
                redis_client.expire(key, window)

            remaining = max(0, limit - current_count - (1 if allowed else 0))
            reset_time = int(now + window)

        else:
            current_count = self._get_memory_count(key, window)
            allowed = current_count < limit
            remaining = max(0, limit - current_count - 1)
            reset_time = int(time.time() + window)

            if allowed:
                self._increment_memory(key, window)

        return allowed, remaining, reset_time

    def _resolve_policy(self, path: str, method: str) -> tuple[str, int, int]:
        """
        Return (policy_name, max_requests, window_seconds) for this request.
        First matching rule wins (most specific overrides first).
        """
        s = settings
        export_path = f"{API_V1_PREFIX}/analytics/export"
        emergency_notify_prefixes = (
            f"{API_V1_PREFIX}/system/emergency/notify",
            f"{API_V1_PREFIX}/emergency/notify",
        )
        auth_prefixes = (
            f"{API_V1_PREFIX}/users/auth",
            f"{API_V1_PREFIX}/auth",
        )
        system_prefix = f"{API_V1_PREFIX}/system"
        strict_suffix = "/telegram"

        if path == export_path or path.startswith(export_path + "/"):
            return (
                POLICY_EXPORT,
                s.RATE_LIMIT_EXPORT_REQUESTS,
                s.RATE_LIMIT_EXPORT_WINDOW_SECONDS,
            )

        for prefix in emergency_notify_prefixes:
            if path == prefix or path.startswith(prefix + "/"):
                return (
                    POLICY_EMERGENCY_NOTIFY,
                    s.RATE_LIMIT_EMERGENCY_NOTIFY_REQUESTS,
                    s.RATE_LIMIT_EMERGENCY_NOTIFY_WINDOW_SECONDS,
                )

        if path.endswith(strict_suffix) and any(path.startswith(p) for p in auth_prefixes):
            return (
                POLICY_AUTH_STRICT,
                s.RATE_LIMIT_AUTH_STRICT_REQUESTS,
                s.RATE_LIMIT_AUTH_STRICT_WINDOW_SECONDS,
            )

        if any(path.startswith(p) for p in auth_prefixes):
            return POLICY_AUTH, s.RATE_LIMIT_AUTH_REQUESTS, s.RATE_LIMIT_AUTH_WINDOW_SECONDS

        if path.startswith(system_prefix):
            return POLICY_SYSTEM, s.RATE_LIMIT_SYSTEM_REQUESTS, s.RATE_LIMIT_SYSTEM_WINDOW_SECONDS

        if method in WRITE_METHODS:
            return POLICY_WRITE, s.RATE_LIMIT_WRITE_REQUESTS, s.RATE_LIMIT_WRITE_WINDOW_SECONDS

        return (
            POLICY_DEFAULT,
            s.RATE_LIMIT_DEFAULT_REQUESTS,
            s.RATE_LIMIT_DEFAULT_WINDOW_SECONDS,
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if os.environ.get("PYTEST_RUNNING") == "1":
            return await call_next(request)

        path = request.url.path
        method = request.method.upper()

        if path in {
            "/",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            f"{API_V1_PREFIX}/system/health",
            f"{API_V1_PREFIX}/system/version",
        }:
            return await call_next(request)

        identifier = await self._resolve_identifier(request, path, method)
        policy, limit, window = self._resolve_policy(path, method)

        redis_client = getattr(request.app.state, "redis_rate_limit", None)

        allowed, remaining, reset_time = self._check_rate_limit(
            identifier,
            policy,
            path,
            limit,
            window,
            redis_client,
        )

        hdrs: dict[str, str] = {}
        _apply_rate_limit_headers(
            hdrs,
            limit=limit,
            remaining=remaining,
            reset_time=reset_time,
            window=window,
            policy=policy,
        )

        if not allowed:
            retry_after = max(1, reset_time - int(time.time()))
            hdrs["Retry-After"] = str(retry_after)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers=hdrs,
            )

        response = await call_next(request)
        for k, v in hdrs.items():
            response.headers[k] = v
        return response

    def _get_ip_identifier(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.client.host if request.client else "unknown"

    async def _resolve_identifier(self, request: Request, path: str, method: str) -> str:
        """Prefer per-user (JWT or validated Telegram identity); otherwise IP."""
        uid = user_id_from_authorization_header(request)
        if uid is not None:
            return f"u:{uid}"

        if path_needs_body_for_rate_limit_identity(path, method):
            body = await request.body()
            uid = telegram_user_id_from_body_for_rate_limit(path, method, body)
            if uid is not None:
                return f"u:{uid}"

        return self._get_ip_identifier(request)


def rate_limit(
    requests: int = 100,
    window: int = 60,
    key_func: Optional[Callable] = None,
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
            request = kwargs.get("request")
            if not request and args:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if not request:
                return await func(*args, **kwargs)

            if key_func:
                _ = key_func(request)
            else:
                forwarded = request.headers.get("X-Forwarded-For")
                if forwarded:
                    _ = forwarded.split(",")[0].strip()
                else:
                    _ = request.client.host if request.client else "unknown"

            return await func(*args, **kwargs)

        return wrapper

    return decorator
