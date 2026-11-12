"""Connection pool configuration (#187).

Pool sizing is env-configurable and applies to PostgreSQL only; SQLite
(dev/tests) must not receive ``pool_size``/``max_overflow`` (its pool classes
reject them).
"""
import pytest

from app.infrastructure.database import build_engine_kwargs
from app.settings import Settings, settings


@pytest.mark.unit
def test_pool_defaults_are_sane():
    assert settings.DB_POOL_SIZE >= 1
    assert settings.DB_MAX_OVERFLOW >= 0
    assert settings.DB_POOL_TIMEOUT >= 1
    assert settings.DB_POOL_RECYCLE >= 0
    assert settings.DB_POOL_PRE_PING is True


@pytest.mark.unit
def test_postgres_url_gets_pool_options():
    kwargs = build_engine_kwargs("postgresql+asyncpg://u:p@localhost:5432/db")
    assert kwargs["pool_size"] == settings.DB_POOL_SIZE
    assert kwargs["max_overflow"] == settings.DB_MAX_OVERFLOW
    assert kwargs["pool_timeout"] == settings.DB_POOL_TIMEOUT
    assert kwargs["pool_recycle"] == settings.DB_POOL_RECYCLE
    assert kwargs["pool_pre_ping"] is settings.DB_POOL_PRE_PING


@pytest.mark.unit
def test_sqlite_url_skips_pool_options():
    kwargs = build_engine_kwargs("sqlite+aiosqlite:///:memory:")
    assert "pool_size" not in kwargs
    assert "max_overflow" not in kwargs
    assert "pool_pre_ping" not in kwargs
    assert kwargs == {"echo": False}


@pytest.mark.unit
def test_pool_values_come_from_env(monkeypatch):
    monkeypatch.setenv("DB_POOL_SIZE", "12")
    monkeypatch.setenv("DB_MAX_OVERFLOW", "3")
    monkeypatch.setenv("DB_POOL_PRE_PING", "false")

    fresh = Settings()

    assert fresh.DB_POOL_SIZE == 12
    assert fresh.DB_MAX_OVERFLOW == 3
    assert fresh.DB_POOL_PRE_PING is False