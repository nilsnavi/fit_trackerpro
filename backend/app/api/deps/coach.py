from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.domain.exceptions import (
    CoachClientRelationshipNotFound,
    CoachFeatureDisabled,
    CoachRoleRequired,
)
from app.domain.user import User
from app.domain.user_role import UserRoleName
from app.infrastructure.database import get_async_db
from app.infrastructure.feature_flags import is_feature_enabled
from app.infrastructure.repositories.coach_repository import (
    CoachClientRepository,
    UserRoleRepository,
)

# ``FEATURE_COACH`` is the public rollout name; persisted flag keys are lower snake case.
FEATURE_COACH = "coach"


async def require_coach_feature(db: AsyncSession = Depends(get_async_db)) -> None:
    if not await is_feature_enabled(db, FEATURE_COACH):
        raise CoachFeatureDisabled()


async def require_coach(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_async_db)
) -> User:
    if not await UserRoleRepository(db).has_role(current_user.id, UserRoleName.COACH):
        raise CoachRoleRequired()
    return current_user


async def require_active_coach_client(
    client_id: int,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    relationship = await CoachClientRepository(db).get_for_coach(coach.id, client_id, active_only=True)
    if not relationship:
        raise CoachClientRelationshipNotFound()
    return relationship
