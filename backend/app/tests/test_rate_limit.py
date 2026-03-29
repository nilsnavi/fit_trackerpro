"""
Тесты логики rate limit: Redis (через fakeredis) и in-memory fallback.

Проверяем одинаковую семантику (allowed / remaining) и сброс окна.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import fakeredis
import redis

from app.middleware.rate_limit import (
    POLICY_DEFAULT,
    RateLimitMiddleware,
    close_rate_limit_redis_client,
    create_rate_limit_redis_client,
)


def _make_middleware() -> RateLimitMiddleware:
    return RateLimitMiddleware(MagicMock())


def _sequence(
    mw: RateLimitMiddleware,
    redis_client: redis.Redis | None,
    *,
    limit: int,
    window: int,
    path: str = "/api/v1/analytics/summary",
    identifier: str = "1.2.3.4",
) -> list[tuple[bool, int]]:
    """Серия вызовов _check_rate_limit; возвращает (allowed, remaining) на каждом шаге."""
    out: list[tuple[bool, int]] = []
    for _ in range(limit + 3):
        allowed, remaining, _ = mw._check_rate_limit(
            identifier,
            POLICY_DEFAULT,
            path,
            limit,
            window,
            redis_client,
        )
        out.append((allowed, remaining))
    return out


def test_memory_and_redis_identical_burst_sequence():
    """Одинаковая последовательность allowed/remaining для памяти и Redis."""
    limit, window = 5, 60
    mw_mem = _make_middleware()
    mw_redis = _make_middleware()
    fake = fakeredis.FakeRedis(decode_responses=True)

    seq_mem = _sequence(mw_mem, None, limit=limit, window=window)
    seq_redis = _sequence(mw_redis, fake, limit=limit, window=window)

    assert seq_mem == seq_redis
    # Первые limit запросов разрешены с убывающим remaining; затем блокировки
    for i in range(limit):
        assert seq_mem[i][0] is True
        assert seq_mem[i][1] == limit - i - 1
    assert seq_mem[limit][0] is False
    assert seq_mem[limit][1] == 0
    assert seq_mem[limit + 1][0] is False


def test_memory_and_redis_identical_after_window_reset(monkeypatch):
    """После истечения окна счётчик сбрасывается одинаково в обоих режимах."""
    limit, window = 3, 30
    t0 = 10_000.0

    def fake_time():
        return fake_time._v  # type: ignore[attr-defined]

    fake_time._v = t0
    monkeypatch.setattr("app.middleware.rate_limit.time.time", fake_time)

    mw_mem = _make_middleware()
    mw_redis = _make_middleware()
    fake = fakeredis.FakeRedis(decode_responses=True)
    path = "/api/v1/challenges/"
    ident = "u:999"

    def step(rc: redis.Redis | None) -> tuple[bool, int]:
        return mw_mem._check_rate_limit(ident, POLICY_DEFAULT, path, limit, window, rc)[:2]

    # Небольшие сдвиги времени: в Redis счётчик — sorted set с членом str(now); при
    # одинаковом now повторный zadd перезаписывает одну запись (как в проде время почти всегда растёт).
    dt = 1e-3

    # Исчерпываем лимит
    for i in range(limit):
        fake_time._v = t0 + i * dt
        a, r = step(None)
        assert a is True
    fake_time._v = t0 + (limit - 1) * dt
    a, _ = step(None)
    assert a is False

    fake_time._v = t0 + window + 0.5
    a, r = step(None)
    assert a is True
    assert r == limit - 1

    # То же для Redis (тот же шаг по времени)
    fake_time._v = t0
    for i in range(limit):
        fake_time._v = t0 + i * dt
        a, r = mw_redis._check_rate_limit(
            ident, POLICY_DEFAULT, path, limit, window, fake
        )[:2]
        assert a is True
    fake_time._v = t0 + (limit - 1) * dt
    a, r = mw_redis._check_rate_limit(
        ident, POLICY_DEFAULT, path, limit, window, fake
    )[:2]
    assert a is False

    fake_time._v = t0 + window + 0.5
    a, r = mw_redis._check_rate_limit(
        ident, POLICY_DEFAULT, path, limit, window, fake
    )[:2]
    assert a is True
    assert r == limit - 1


def test_memory_isolated_per_middleware_instance():
    """In-memory хранилище не общее между экземплярами middleware (изоляция)."""
    mw1 = _make_middleware()
    mw2 = _make_middleware()
    limit, window = 2, 60
    path = "/api/v1/foo"
    ident = "ip-a"

    for _ in range(limit):
        assert mw1._check_rate_limit(ident, POLICY_DEFAULT, path, limit, window, None)[0]
    assert not mw1._check_rate_limit(ident, POLICY_DEFAULT, path, limit, window, None)[0]

    # Второй экземпляр — чистый счётчик
    assert mw2._check_rate_limit(ident, POLICY_DEFAULT, path, limit, window, None)[0]


def test_redis_keys_isolated_per_path():
    """Разные path дают независимые счётчики в Redis."""
    mw = _make_middleware()
    fake = fakeredis.FakeRedis(decode_responses=True)
    limit, window = 1, 60
    ident = "1.1.1.1"

    assert mw._check_rate_limit(
        ident, POLICY_DEFAULT, "/api/v1/a", limit, window, fake
    )[0]
    assert not mw._check_rate_limit(
        ident, POLICY_DEFAULT, "/api/v1/a", limit, window, fake
    )[0]

    assert mw._check_rate_limit(
        ident, POLICY_DEFAULT, "/api/v1/b", limit, window, fake
    )[0]


def test_create_rate_limit_redis_client_returns_none_on_connection_error(monkeypatch):
    """При недоступности Redis клиент не создаётся (fallback в память в middleware)."""

    def fail(*_a, **_kw):
        raise redis.ConnectionError("refused")

    monkeypatch.setattr("app.middleware.rate_limit.redis.from_url", fail)
    assert create_rate_limit_redis_client() is None


def test_close_rate_limit_redis_client_accepts_none():
    close_rate_limit_redis_client(None)


def test_close_rate_limit_redis_client_closes_real_client():
    fake = fakeredis.FakeRedis(decode_responses=True)
    close_rate_limit_redis_client(fake)
