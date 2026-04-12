"""
Тесты логики rate limit: Redis (через fakeredis) и in-memory fallback.

Проверяем одинаковую семантику (allowed / remaining) и сброс окна.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import fakeredis
import pytest
import redis
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.exception_handlers import register_exception_handlers
from app.middleware.rate_limit import (
    POLICY_DEFAULT,
    RateLimitMiddleware,
    close_rate_limit_redis_client,
    create_rate_limit_redis_client,
)
from app.settings import settings


def _make_middleware() -> RateLimitMiddleware:
    return RateLimitMiddleware(MagicMock())


def _sequence(
    mw: RateLimitMiddleware,
    redis_client: redis.Redis | None,
    *,
    limit: int,
    window: int,
    path: str = "/api/v1/ratelimit-test/ping",
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


def _build_rate_limited_app(*, redis_client: redis.Redis | None) -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.state.redis_rate_limit = redis_client

    @app.get("/api/v1/ratelimit-test/ping")
    async def ping():
        return {"ok": True}

    app.add_middleware(RateLimitMiddleware)
    return app


@pytest.mark.asyncio
async def test_middleware_allows_normal_traffic_and_sets_headers(monkeypatch):
    monkeypatch.setenv("PYTEST_RUNNING", "0")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_REQUESTS", 2)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_WINDOW_SECONDS", 60)

    app = _build_rate_limited_app(redis_client=None)  # fallback mode (in-memory)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/api/v1/ratelimit-test/ping")
        assert r1.status_code == 200
        assert r1.headers["X-RateLimit-Limit"] == "2"
        assert r1.headers["X-RateLimit-Remaining"] == "1"
        assert r1.headers["X-RateLimit-Window"] == "60"
        assert r1.headers["X-RateLimit-Policy"] == POLICY_DEFAULT

        r2 = await client.get("/api/v1/ratelimit-test/ping")
        assert r2.status_code == 200
        assert r2.headers["X-RateLimit-Remaining"] == "0"


@pytest.mark.asyncio
async def test_middleware_returns_429_on_limit_exceeded_with_retry_after(monkeypatch):
    monkeypatch.setenv("PYTEST_RUNNING", "0")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_REQUESTS", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_WINDOW_SECONDS", 30)

    app = _build_rate_limited_app(redis_client=None)  # fallback mode (in-memory)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ok = await client.get("/api/v1/ratelimit-test/ping")
        assert ok.status_code == 200

        blocked = await client.get("/api/v1/ratelimit-test/ping")
        assert blocked.status_code == 429
        assert "Rate limit exceeded" in blocked.text
        assert blocked.headers["X-RateLimit-Limit"] == "1"
        assert blocked.headers["X-RateLimit-Remaining"] == "0"
        assert blocked.headers["X-RateLimit-Window"] == "30"
        assert blocked.headers["X-RateLimit-Policy"] == POLICY_DEFAULT
        assert int(blocked.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_middleware_window_resets_after_time_advance(monkeypatch):
    monkeypatch.setenv("PYTEST_RUNNING", "0")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_REQUESTS", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_WINDOW_SECONDS", 10)

    t0 = 50_000.0

    def fake_time():
        return fake_time._v  # type: ignore[attr-defined]

    fake_time._v = t0
    monkeypatch.setattr("app.middleware.rate_limit.time.time", fake_time)

    app = _build_rate_limited_app(redis_client=None)  # fallback mode (in-memory)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/api/v1/ratelimit-test/ping")
        assert r1.status_code == 200

        # Still in the same window -> blocked
        fake_time._v = t0 + 1
        r2 = await client.get("/api/v1/ratelimit-test/ping")
        assert r2.status_code == 429

        # After window -> allowed again
        fake_time._v = t0 + 10.5
        r3 = await client.get("/api/v1/ratelimit-test/ping")
        assert r3.status_code == 200
        assert r3.headers["X-RateLimit-Remaining"] == "0"


@pytest.mark.asyncio
async def test_middleware_uses_redis_and_sets_ttl(monkeypatch):
    monkeypatch.setenv("PYTEST_RUNNING", "0")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_REQUESTS", 2)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_WINDOW_SECONDS", 60)

    fake = fakeredis.FakeRedis(decode_responses=True)
    app = _build_rate_limited_app(redis_client=fake)

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/api/v1/ratelimit-test/ping", headers={"X-Forwarded-For": "9.9.9.9"})
        assert r1.status_code == 200

    # Проверяем, что ключ создан и имеет TTL (expire(key, window)).
    keys = [k for k in fake.keys() if "ratelimit:" in k]
    assert len(keys) == 1
    ttl = fake.ttl(keys[0])
    assert ttl > 0
    assert ttl <= 60


@pytest.mark.asyncio
async def test_telegram_auth_slowapi_eleventh_post_returns_429_with_retry_after():
    """POST /users/auth/telegram: SlowAPI 10/min per IP; 11th response is 429 with Retry-After."""
    from app.core.limiter import limiter
    from app.main import app

    limiter.reset()
    url = "/api/v1/users/auth/telegram"
    payload = {"init_data": "invalid-signature-payload"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for _ in range(10):
            resp = await ac.post(url, json=payload)
            assert resp.status_code != 429, resp.text
        blocked = await ac.post(url, json=payload)
    assert blocked.status_code == 429
    ra = blocked.headers.get("Retry-After") or blocked.headers.get("retry-after")
    assert ra is not None
    assert int(ra) >= 1
