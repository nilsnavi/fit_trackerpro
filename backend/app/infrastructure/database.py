"""
Async SQLAlchemy engine and session factory (persistence wiring).
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings

# Import domain so all ORM models attach to Base.metadata (Alembic, tests).
from app.domain import Base  # noqa: F401

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
