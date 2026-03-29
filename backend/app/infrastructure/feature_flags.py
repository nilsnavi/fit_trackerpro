"""
Feature flag helpers (delegate persistence to FeatureFlagsRepository).
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.feature_flags_repository import FeatureFlagsRepository


async def is_feature_enabled(db: AsyncSession, key: str, default: bool = False) -> bool:
    """
    Check if a feature flag is enabled.

    Returns `default` when the flag is missing.
    """
    return await FeatureFlagsRepository(db).is_enabled(key, default=default)


async def get_feature_flags(db: AsyncSession) -> dict[str, bool]:
    """Return all feature flags as {key: enabled}."""
    return await FeatureFlagsRepository(db).get_all()
