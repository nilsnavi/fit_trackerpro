"""
Idempotency for sensitive mutations: the same ``Idempotency-Key`` header (scoped per
user) replays the first successful JSON-serialized result within TTL.

Uses in-process locks to serialize concurrent duplicates; optional Redis (via the
analytics cache client) for cross-process replay when ``ANALYTICS_CACHE_ENABLED``.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Awaitable, Callable, TypeVar

from app.domain.exceptions import IdempotencyKeyInvalidError
from app.infrastructure.cache import get_redis_cache_client

logger = logging.getLogger(__name__)

T = TypeVar("T")

_memory: dict[str, tuple[float, str]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _storage_key(user_id: int, scope: str, raw_key: str) -> str:
    digest = hashlib.sha256(f"{user_id}|{scope}|{raw_key}".encode()).hexdigest()
    return f"idempotency:v1:{digest}"


def _memory_get(key: str) -> Any | None:
    entry = _memory.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if expires_at <= time.time():
        _memory.pop(key, None)
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        _memory.pop(key, None)
        return None


def _memory_set(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    except (TypeError, ValueError):
        return
    _memory[key] = (time.time() + ttl_seconds, payload)


def _lock_for(key: str) -> asyncio.Lock:
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


async def run_idempotent(
    *,
    user_id: int,
    scope: str,
    raw_key: str | None,
    ttl_seconds: int,
    execute: Callable[[], Awaitable[T]],
    serialize_result: Callable[[T], Any],
    deserialize_result: Callable[[Any], T],
) -> T:
    """
    Empty ``raw_key`` runs ``execute`` once with no caching.

    Otherwise returns cached ``serialize_result`` output for duplicate keys, or
    runs ``execute`` and caches the serialized payload.
    """
    if not raw_key or not raw_key.strip():
        return await execute()

    key = raw_key.strip()
    if len(key) > 256:
        raise IdempotencyKeyInvalidError("Idempotency-Key must be at most 256 characters")

    storage_key = _storage_key(user_id, scope, key)

    async with _lock_for(storage_key):
        cached = _memory_get(storage_key)
        if cached is None:
            redis_client = await get_redis_cache_client()
            if redis_client is not None:
                try:
                    raw = await redis_client.get(storage_key)
                    if raw:
                        cached = json.loads(raw)
                        _memory_set(storage_key, cached, ttl_seconds)
                except Exception as e:
                    logger.debug("Idempotency Redis read failed: %s", e)

        if cached is not None:
            return deserialize_result(cached)

        result = await execute()
        payload = serialize_result(result)
        _memory_set(storage_key, payload, ttl_seconds)

        redis_client = await get_redis_cache_client()
        if redis_client is not None:
            try:
                await redis_client.setex(
                    storage_key,
                    ttl_seconds,
                    json.dumps(payload, ensure_ascii=True, separators=(",", ":")),
                )
            except Exception as e:
                logger.debug("Idempotency Redis write failed: %s", e)

        return result
