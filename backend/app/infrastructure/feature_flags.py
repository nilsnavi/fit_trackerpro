"""
Feature flag helpers.
"""
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession


async def is_feature_enabled(db: AsyncSession, key: str, default: bool = False) -> bool:
    """
    Check if a feature flag is enabled.

    Returns `default` when the flag is missing.
    """
    try:
        result = await db.execute(
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


async def get_feature_flags(db: AsyncSession) -> dict[str, bool]:
    """
    Return all feature flags as {key: enabled}.
    """
    try:
        result = await db.execute(
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
