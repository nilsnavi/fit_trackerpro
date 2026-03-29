"""
Async SQLAlchemy engine and session factory (persistence wiring).
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings

from app.domain.base import Base  # noqa: F401
import app.domain.registry  # noqa: F401 — attach all ORM models to Base.metadata

engine = create_async_engine(settings.DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_async_db():
    """FastAPI dependency: async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
