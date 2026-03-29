"""Shared SQLAlchemy session helpers for repository implementations."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


class SQLAlchemyRepository:
    """Thin wrapper around AsyncSession for consistent persistence operations."""

    __slots__ = ("db",)

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def commit(self) -> None:
        await self.db.commit()

    async def refresh(self, instance: object) -> None:
        await self.db.refresh(instance)

    def add(self, instance: object) -> None:
        self.db.add(instance)

    async def delete(self, instance: object) -> None:
        await self.db.delete(instance)
