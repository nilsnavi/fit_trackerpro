"""Read-only server authorization checks for explicit Coach–Client grants.

No endpoint creates grants in V2-03C.1. A positive decision is never cached.
"""
from __future__ import annotations

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_client_grant import (
    COACH_GRANT_CONSENT_VERSION,
    SUPPORTED_COACH_GRANT_SCOPES,
    CoachClientGrant,
    CoachGrantStatus,
)
from app.domain.coach_profile import CoachProfile
from app.domain.user_role import UserRole, UserRoleName
from app.infrastructure.feature_flags import is_feature_enabled


class CoachGrantRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def is_allowed(self, *, coach_id: int, client_id: int, scope: str) -> bool:
        """Check exact coach, client, active relation, role, profile and valid grant."""
        if coach_id <= 0 or client_id <= 0 or coach_id == client_id:
            return False
        if scope not in SUPPORTED_COACH_GRANT_SCOPES:
            return False
        if not await is_feature_enabled(self.db, "coach"):
            return False

        allowed = select(CoachClientGrant.id).join(
            CoachClient,
            and_(
                CoachClient.id == CoachClientGrant.relationship_id,
                CoachClient.coach_id == CoachClientGrant.coach_id,
                CoachClient.client_id == CoachClientGrant.client_id,
            ),
        ).join(
            CoachProfile,
            and_(
                CoachProfile.user_id == CoachClientGrant.coach_id,
                CoachProfile.is_active.is_(True),
            ),
        ).join(
            UserRole,
            and_(
                UserRole.user_id == CoachClientGrant.coach_id,
                UserRole.role == UserRoleName.COACH,
            ),
        ).where(
            CoachClientGrant.coach_id == coach_id,
            CoachClientGrant.client_id == client_id,
            CoachClientGrant.scope == scope,
            CoachClientGrant.status == CoachGrantStatus.ACTIVE,
            CoachClientGrant.consent_version == COACH_GRANT_CONSENT_VERSION,
            CoachClientGrant.revoked_at.is_(None),
            CoachClient.status == CoachClientStatus.ACTIVE,
            CoachClient.ended_at.is_(None),
            CoachClient.archived_at.is_(None),
            or_(CoachClientGrant.expires_at.is_(None), CoachClientGrant.expires_at > func.now()),
        ).limit(1)
        return (await self.db.scalar(allowed)) is not None
