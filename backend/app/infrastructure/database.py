"""
Async SQLAlchemy engine and session factory (persistence wiring).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import app.domain.registry  # noqa: F401 — attach all ORM models to Base.metadata
from app.domain.base import Base  # noqa: F401
from app.settings import settings


def build_engine_kwargs(database_url: str) -> dict[str, Any]:
    """Engine options for ``create_async_engine``.

    Connection-pool sizing applies to PostgreSQL only. SQLite (dev/tests) uses
    its own pool classes that reject ``pool_size``/``max_overflow``, so those
    options are intentionally skipped there.
    """
    kwargs: dict[str, Any] = {"echo": False}
    if database_url.startswith(("postgresql://", "postgresql+")):
        kwargs.update(
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
        )
    return kwargs


engine = create_async_engine(
    settings.DATABASE_URL, **build_engine_kwargs(settings.DATABASE_URL)
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def init_db() -> None:
    """Verify DB connectivity and (optionally) ensure schema exists."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    # Local dev convenience: schema bootstrap (no Alembic migrations in repo).
    if settings.ENVIRONMENT.strip().lower() == "development" and settings.AUTO_CREATE_DB_SCHEMA:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Dispose engine and close all pooled connections."""
    await engine.dispose()


async def get_async_db():
    """FastAPI dependency: async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()