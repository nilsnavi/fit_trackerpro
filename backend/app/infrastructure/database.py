"""
Async SQLAlchemy engine and session factory (persistence wiring).
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings

from app.domain.base import Base  # noqa: F401
import app.domain.registry  # noqa: F401 — attach all ORM models to Base.metadata

engine = create_async_engine(settings.DATABASE_URL, echo=False)

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
