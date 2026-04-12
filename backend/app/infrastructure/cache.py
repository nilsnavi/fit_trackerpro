"""
Async cache helpers with Redis + in-memory fallback.
"""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from redis.asyncio import Redis

from app.settings import settings

_redis_client: Optional[Redis] = None
_memory_cache: dict[str, tuple[float, str]] = {}


def _ensure_redis_singleton() -> Redis:
    """Lazily create the shared async ``Redis`` client (same instance as cache / readiness)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
    return _redis_client


async def ensure_async_redis_client() -> Redis:
    """Return shared async Redis (``REDIS_URL``); used by readiness PING and cache layer."""
    return _ensure_redis_singleton()


def _memory_get(key: str) -> Optional[Any]:
    now = time.time()
    entry = _memory_cache.get(key)
    if not entry:
        return None

    expires_at, payload = entry
    if expires_at <= now:
        _memory_cache.pop(key, None)
        return None

    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        _memory_cache.pop(key, None)
        return None


def _memory_set(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    except (TypeError, ValueError):
        return
    _memory_cache[key] = (time.time() + ttl_seconds, payload)


async def get_redis_cache_client() -> Optional[Redis]:
    """Shared Redis client for cache and idempotency (``None`` if cache disabled)."""
    return await _get_redis_client()


async def _get_redis_client() -> Optional[Redis]:
    if not settings.ANALYTICS_CACHE_ENABLED:
        return None
    return _ensure_redis_singleton()


async def close_cache() -> None:
    """Close async Redis used for analytics cache (safe if never opened)."""
    global _redis_client
    if _redis_client is None:
        return
    client = _redis_client
    _redis_client = None
    await client.aclose()


async def get_cache_json(key: str) -> Optional[Any]:
    """
    Read JSON payload from cache.

    Priority:
    1) in-memory cache
    2) Redis
    """
    if settings.ANALYTICS_MEMORY_CACHE_ENABLED:
        in_memory_value = _memory_get(key)
        if in_memory_value is not None:
            return in_memory_value

    redis_client = await _get_redis_client()
    if redis_client is None:
        return None

    try:
        payload = await redis_client.get(key)
        if not payload:
            return None
        value = json.loads(payload)
        if settings.ANALYTICS_MEMORY_CACHE_ENABLED:
            _memory_set(key, value, settings.ANALYTICS_MEMORY_CACHE_TTL_SECONDS)
        return value
    except Exception:
        return None


async def set_cache_json(key: str, value: Any, ttl_seconds: int) -> None:
    """
    Store JSON payload in cache.
    """
    if settings.ANALYTICS_MEMORY_CACHE_ENABLED:
        _memory_set(key, value, settings.ANALYTICS_MEMORY_CACHE_TTL_SECONDS)

    redis_client = await _get_redis_client()
    if redis_client is None:
        return

    try:
        payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
        await redis_client.setex(key, ttl_seconds, payload)
    except Exception:
        return


async def invalidate_user_analytics_cache(user_id: int) -> None:
    """
    Invalidate analytics cache entries for a specific user.
    """
    user_key_part = f":u:{user_id}"

    # In-memory invalidation
    if _memory_cache:
        keys_to_delete = [
            key for key in _memory_cache.keys()
            if key.startswith("analytics:") and user_key_part in key
        ]
        for key in keys_to_delete:
            _memory_cache.pop(key, None)

    # Redis invalidation
    redis_client = await _get_redis_client()
    if redis_client is None:
        return

    try:
        pattern = f"analytics:*{user_key_part}*"
        async for key in redis_client.scan_iter(match=pattern, count=200):
            await redis_client.delete(key)
    except Exception:
        return
