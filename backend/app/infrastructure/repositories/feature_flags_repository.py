"""Persistence access for `feature_flags` table (raw SQL — no ORM model in project)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.infrastructure.repositories.base import SQLAlchemyRepository


class FeatureFlagsRepository(SQLAlchemyRepository):
    async def is_enabled(self, key: str, default: bool = False) -> bool:
        try:
            result = await self.db.execute(
                text(
                    """
                    SELECT enabled
                    FROM feature_flags
                    WHERE key = :key
                    LIMIT 1
                    """
                ),
                {"key": key},
            )
            enabled = result.scalar_one_or_none()
            if enabled is None:
                return default
            return bool(enabled)
        except SQLAlchemyError:
            return default

    async def get_all(self) -> dict[str, bool]:
        try:
            result = await self.db.execute(
                text(
                    """
                    SELECT key, enabled
                    FROM feature_flags
                    """
                )
            )
            return {row.key: bool(row.enabled) for row in result.mappings().all()}
        except SQLAlchemyError:
            return {}
