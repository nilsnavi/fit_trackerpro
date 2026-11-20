"""Client-owned grants: scoped, explicit, and transactionally audited."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_client_grant import (
    COACH_GRANT_CONSENT_VERSION,
    CoachClientGrant,
    CoachGrantStatus,
)
from app.domain.coach_grant_audit import CoachGrantAudit
from app.domain.coach_profile import CoachProfile
from app.domain.user_role import UserRole, UserRoleName
from app.infrastructure.feature_flags import is_feature_enabled
from app.schemas.coach_grants import (
    AvailableCoach,
    GrantCreate,
    GrantHistory,
    GrantView,
)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(status_code=422, detail="Expiration must have timezone")
    return value.astimezone(UTC)


class ClientGrantService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def available_coaches(self, client_id: int) -> list[AvailableCoach]:
        """Return only active CoachClient links owned by the authenticated athlete."""
        if not await is_feature_enabled(self.db, "coach"):
            return []
        rows = (await self.db.execute(
            select(CoachClient.coach_id, CoachProfile.display_name)
            .join(CoachProfile, CoachProfile.user_id == CoachClient.coach_id)
            .join(
                UserRole,
                (UserRole.user_id == CoachClient.coach_id)
                & (UserRole.role == UserRoleName.COACH),
            )
            .where(
                CoachClient.client_id == client_id,
                CoachClient.status == CoachClientStatus.ACTIVE,
                CoachClient.ended_at.is_(None),
                CoachClient.archived_at.is_(None),
                CoachProfile.is_active.is_(True),
            )
            .order_by(CoachProfile.display_name, CoachClient.coach_id)
        )).all()
        return [
            AvailableCoach(coach_id=coach_id, display_name=display_name)
            for coach_id, display_name in rows
        ]

    async def history(self, client_id: int, grant_id: str) -> GrantHistory:
        """Read consent events for this grant's owner only."""
        try:
            grant_id = str(UUID(grant_id))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=404, detail="Grant not found") from None
        owned = await self.db.scalar(
            select(CoachClientGrant.id).where(
                CoachClientGrant.id == grant_id,
                CoachClientGrant.client_id == client_id,
            )
        )
        if owned is None:
            raise HTTPException(status_code=404, detail="Grant not found")
        events = list((await self.db.scalars(
            select(CoachGrantAudit).where(
                CoachGrantAudit.grant_id == grant_id,
                CoachGrantAudit.client_id == client_id,
            ).order_by(CoachGrantAudit.occurred_at.desc(), CoachGrantAudit.id.desc())
        )).all())
        return GrantHistory(grant_id=grant_id, events=events)

    async def list_owned(self, client_id: int) -> list[GrantView]:
        result = await self.db.scalars(
            select(CoachClientGrant).where(CoachClientGrant.client_id == client_id)
            .order_by(CoachClientGrant.created_at.desc())
        )
        return [GrantView.model_validate(grant) for grant in result]

    async def grant(self, client_id: int, data: GrantCreate) -> GrantView:
        if data.coach_id == client_id:
            raise HTTPException(status_code=409, detail="Cannot grant access to self")
        if data.consent_version != COACH_GRANT_CONSENT_VERSION:
            raise HTTPException(status_code=409, detail="Unsupported consent version")
        if data.expires_at is not None:
            expires_at = _utc(data.expires_at)
            if not datetime.now(UTC) + timedelta(seconds=30) < expires_at <= datetime.now(UTC) + timedelta(days=365):
                raise HTTPException(status_code=422, detail="Expiration out of range")
        else:
            expires_at = None
        if not await is_feature_enabled(self.db, "coach"):
            raise HTTPException(status_code=404, detail="Coach access unavailable")

        # The row lock serializes concurrent grants/revocations for this exact relationship.
        relationship = await self.db.scalar(
            select(CoachClient)
            .where(
                CoachClient.client_id == client_id,
                CoachClient.coach_id == data.coach_id,
                CoachClient.status == CoachClientStatus.ACTIVE,
                CoachClient.ended_at.is_(None),
                CoachClient.archived_at.is_(None),
            ).with_for_update()
        )
        if relationship is None:
            raise HTTPException(status_code=404, detail="Coach relationship not found")
        active_coach = await self.db.scalar(
            select(CoachProfile.id).join(
                UserRole, UserRole.user_id == CoachProfile.user_id
            ).where(
                CoachProfile.user_id == data.coach_id,
                CoachProfile.is_active.is_(True),
                UserRole.role == UserRoleName.COACH,
            )
        )
        if active_coach is None:
            raise HTTPException(status_code=404, detail="Coach unavailable")
        record = await self.db.scalar(
            select(CoachClientGrant).where(
                CoachClientGrant.relationship_id == relationship.id,
                CoachClientGrant.scope == data.scope,
            ).with_for_update()
        )
        if record is not None and record.status == CoachGrantStatus.ACTIVE and record.revoked_at is None:
            current_expiry = record.expires_at
            if current_expiry is not None and current_expiry.tzinfo is None:
                current_expiry = current_expiry.replace(tzinfo=UTC)
            if record.consent_version == data.consent_version and current_expiry == expires_at:
                return GrantView.model_validate(record)
            raise HTTPException(status_code=409, detail="Existing consent differs; revoke before changing")

        now = datetime.now(UTC)
        if record is None:
            record = CoachClientGrant(
                relationship_id=relationship.id, coach_id=data.coach_id,
                client_id=client_id, scope=data.scope, status=CoachGrantStatus.ACTIVE,
                consent_version=data.consent_version, granted_at=now, expires_at=expires_at,
            )
            self.db.add(record)
        else:
            # Explicit new POST is the only way to reinstate a revoked or expired grant.
            record.status = CoachGrantStatus.ACTIVE
            record.revoked_at = None
            record.granted_at = now
            record.expires_at = expires_at
            record.consent_version = data.consent_version
        try:
            await self.db.flush()
            self.db.add(CoachGrantAudit(
                grant_id=record.id, relationship_id=record.relationship_id,
                coach_id=record.coach_id, client_id=client_id, actor_id=client_id,
                scope=record.scope, consent_version=record.consent_version, action="GRANTED",
            ))
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(status_code=409, detail="Concurrent grant update") from exc
        await self.db.refresh(record)
        audit_log(action="coach.grant.created", user_db_id=client_id,
                  resource_type="coach_grant", resource_id=record.id,
                  meta={"coach_id": record.coach_id, "scope": record.scope})
        return GrantView.model_validate(record)

    async def revoke(self, client_id: int, grant_id: str) -> None:
        try:
            grant_id = str(UUID(grant_id))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=404, detail="Grant not found") from None
        # Lock the relationship first, consistent with the grant operation.
        relation = await self.db.scalar(
            select(CoachClient).join(
                CoachClientGrant, CoachClientGrant.relationship_id == CoachClient.id
            ).where(
                CoachClientGrant.id == grant_id,
                CoachClientGrant.client_id == client_id,
                CoachClient.client_id == client_id,
            ).with_for_update()
        )
        if relation is None:
            raise HTTPException(status_code=404, detail="Grant not found")
        record = await self.db.scalar(
            select(CoachClientGrant).where(
                CoachClientGrant.id == grant_id, CoachClientGrant.client_id == client_id,
                CoachClientGrant.relationship_id == relation.id,
            ).with_for_update()
        )
        if record is None:
            raise HTTPException(status_code=404, detail="Grant not found")
        if record.status == CoachGrantStatus.REVOKED:
            return
        record.status = CoachGrantStatus.REVOKED
        record.revoked_at = datetime.now(UTC)
        self.db.add(CoachGrantAudit(
            grant_id=record.id, relationship_id=record.relationship_id,
            coach_id=record.coach_id, client_id=client_id, actor_id=client_id,
            scope=record.scope, consent_version=record.consent_version, action="REVOKED",
        ))
        await self.db.commit()
        audit_log(action="coach.grant.revoked", user_db_id=client_id,
                  resource_type="coach_grant", resource_id=record.id,
                  meta={"coach_id": record.coach_id, "scope": record.scope})
