from __future__ import annotations

import asyncio
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from weakref import WeakKeyDictionary

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.coach_entitlement_service import CoachEntitlementService
from app.core.audit import (
    COACH_INVITATION_ACCEPT,
    COACH_INVITATION_CREATE,
    COACH_INVITATION_REVOKE,
    COACH_PROFILE_CREATE,
    COACH_PROFILE_UPDATE,
    COACH_RELATIONSHIP_CREATE,
    COACH_RELATIONSHIP_STATUS_CHANGE,
    audit_log,
)
from app.domain.coach_client import DEFAULT_COACH_CLIENT_PERMISSIONS, CoachClient, CoachClientStatus
from app.domain.coach_invitation import CoachInvitation, CoachInvitationStatus
from app.domain.coach_profile import CoachProfile
from app.domain.exceptions import (
    CoachClientAlreadyExists,
    CoachClientRelationshipNotFound,
    CoachInvitationAlreadyUsed,
    CoachInvitationExpired,
    CoachInvitationNotFound,
    CoachInvitationRevoked,
    CoachProfileAlreadyExists,
    CoachProfileNotFound,
)
from app.domain.user_role import UserRoleName
from app.infrastructure.repositories.coach_repository import (
    CoachClientRepository,
    CoachInvitationRepository,
    CoachProfileRepository,
    UserRoleRepository,
)
from app.schemas.coach import (
    CoachClientDetailResponse,
    CoachClientResponse,
    CoachClientUpdate,
    CoachInvitationCreate,
    CoachInvitationCreatedResponse,
    CoachInvitationResolveResponse,
    CoachInvitationResponse,
    CoachProfileCreate,
    CoachProfileResponse,
    CoachProfileUpdate,
)

_SQLITE_ACCEPT_LOCKS: WeakKeyDictionary[asyncio.AbstractEventLoop, dict[int, asyncio.Lock]] = WeakKeyDictionary()


def _sqlite_accept_lock(coach_id: int) -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    coach_locks = _SQLITE_ACCEPT_LOCKS.setdefault(loop, {})
    return coach_locks.setdefault(coach_id, asyncio.Lock())

INVITATION_TTL = timedelta(days=7)


def invitation_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    """SQLite test databases can deserialize timezone-aware columns as naive values."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class CoachIdentityService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.profiles = CoachProfileRepository(db)
        self.roles = UserRoleRepository(db)

    async def create_profile(
        self, user_id: int, data: CoachProfileCreate, client_ip: str | None = None
    ) -> CoachProfileResponse:
        try:
            if await self.profiles.get_by_user_id(user_id):
                raise CoachProfileAlreadyExists()
            if not await self.roles.has_role(user_id, UserRoleName.COACH):
                await self.roles.activate_coach(user_id)
            profile = await self.profiles.create(CoachProfile(user_id=user_id, **data.model_dump()))
            await CoachEntitlementService(self.db).create_trial_for_new_profile(user_id)
            await self.db.commit()
            await self.db.refresh(profile)
        except IntegrityError as exc:
            await self.db.rollback()
            raise CoachProfileAlreadyExists() from exc
        audit_log(action=COACH_PROFILE_CREATE, user_db_id=user_id, resource_type="coach_profile", resource_id=profile.id, client_ip=client_ip)
        return CoachProfileResponse.model_validate(profile)

    async def get_profile(self, user_id: int) -> CoachProfileResponse:
        profile = await self.profiles.get_by_user_id(user_id)
        if not profile:
            raise CoachProfileNotFound()
        return CoachProfileResponse.model_validate(profile)

    async def update_profile(
        self, user_id: int, data: CoachProfileUpdate, client_ip: str | None = None
    ) -> CoachProfileResponse:
        profile = await self.profiles.get_by_user_id(user_id)
        if not profile:
            raise CoachProfileNotFound()
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
        await self.db.commit()
        await self.db.refresh(profile)
        audit_log(
            action=COACH_PROFILE_UPDATE,
            user_db_id=user_id,
            resource_type="coach_profile",
            resource_id=profile.id,
            client_ip=client_ip,
        )
        return CoachProfileResponse.model_validate(profile)


class CoachInvitationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.invitations = CoachInvitationRepository(db)
        self.profiles = CoachProfileRepository(db)
        self.clients = CoachClientRepository(db)

    async def create(self, coach_id: int, data: CoachInvitationCreate, client_ip: str | None = None) -> CoachInvitationCreatedResponse:
        await CoachEntitlementService(self.db).require_capacity(coach_id, "clients")
        token = secrets.token_urlsafe(32)
        invitation = CoachInvitation(coach_id=coach_id, client_hint=data.client_hint, token_hash=invitation_token_hash(token), expires_at=_now() + INVITATION_TTL)
        await self.invitations.create(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)
        audit_log(action=COACH_INVITATION_CREATE, user_db_id=coach_id, resource_type="coach_invitation", resource_id=invitation.id, client_ip=client_ip)
        return CoachInvitationCreatedResponse(
            **CoachInvitationResponse.model_validate(invitation).model_dump(), token=token
        )

    async def list(self, coach_id: int) -> list[CoachInvitationResponse]:
        return [CoachInvitationResponse.model_validate(item) for item in await self.invitations.list_for_coach(coach_id)]

    async def revoke(self, coach_id: int, invitation_id: str, client_ip: str | None = None) -> None:
        invitation = await self.invitations.get_for_coach(coach_id, invitation_id, lock=True)
        if not invitation:
            raise CoachInvitationNotFound()
        try:
            if invitation.status != CoachInvitationStatus.PENDING:
                if invitation.status == CoachInvitationStatus.ACCEPTED:
                    raise CoachInvitationAlreadyUsed()
                if invitation.status == CoachInvitationStatus.EXPIRED:
                    raise CoachInvitationExpired()
                raise CoachInvitationRevoked()
            if _as_utc(invitation.expires_at) <= _now():
                invitation.status = CoachInvitationStatus.EXPIRED
                await self.db.commit()
                raise CoachInvitationExpired()
            invitation.status, invitation.revoked_at = CoachInvitationStatus.REVOKED, _now()
            await self.db.commit()
        except CoachInvitationExpired:
            raise
        except (CoachInvitationAlreadyUsed, CoachInvitationRevoked):
            await self.db.rollback()
            raise
        except IntegrityError as exc:
            await self.db.rollback()
            raise CoachInvitationNotFound() from exc
        audit_log(action=COACH_INVITATION_REVOKE, user_db_id=coach_id, resource_type="coach_invitation", resource_id=invitation.id, client_ip=client_ip)

    async def resolve(self, token: str) -> CoachInvitationResolveResponse:
        invitation = await self.invitations.get_by_hash(invitation_token_hash(token))
        if not invitation:
            raise CoachInvitationNotFound()
        try:
            self._ensure_usable(invitation)
        except CoachInvitationExpired:
            await self.db.commit()
            raise
        profile = await self.profiles.get_by_user_id(invitation.coach_id)
        if not profile or not profile.is_active:
            raise CoachInvitationNotFound()
        return CoachInvitationResolveResponse(invitation_id=invitation.id, coach=CoachProfileResponse.model_validate(profile), permissions=DEFAULT_COACH_CLIENT_PERMISSIONS, expires_at=invitation.expires_at)

    async def accept(
        self, client_id: int, token: str, client_ip: str | None = None
    ) -> CoachClientResponse:
        if self.db.get_bind().dialect.name == "sqlite":
            invitation = await self.invitations.get_by_hash(invitation_token_hash(token))
            if not invitation:
                raise CoachInvitationNotFound()
            coach_id = invitation.coach_id
            # End the initial read transaction before waiting so a queued SQLite request
            # starts a fresh transaction and sees the slot consumed by the prior accept.
            await self.db.rollback()
            async with _sqlite_accept_lock(coach_id):
                return await self._accept_locked(client_id, token, client_ip)
        return await self._accept_locked(client_id, token, client_ip)

    async def _accept_locked(
        self, client_id: int, token: str, client_ip: str | None
    ) -> CoachClientResponse:
        try:
            invitation = await self.invitations.get_by_hash(invitation_token_hash(token), lock=True)
            if not invitation:
                raise CoachInvitationNotFound()
            self._ensure_usable(invitation)
            if invitation.coach_id == client_id:
                raise CoachClientAlreadyExists("A coach cannot accept their own invitation")
            await CoachEntitlementService(self.db).require_capacity(invitation.coach_id, "clients")
            relationship = await self.clients.get_for_coach(
                invitation.coach_id, client_id, current_only=True
            )
            if relationship:
                raise CoachClientAlreadyExists()
            relationship = await self.clients.create(
                CoachClient(coach_id=invitation.coach_id, client_id=client_id)
            )
            invitation.status = CoachInvitationStatus.ACCEPTED
            invitation.accepted_by_user_id = client_id
            invitation.accepted_at = _now()
            await self.db.commit()
            await self.db.refresh(relationship)
        except CoachInvitationExpired:
            await self.db.commit()
            raise
        except IntegrityError as exc:
            await self.db.rollback()
            raise CoachClientAlreadyExists() from exc
        except CoachClientAlreadyExists:
            await self.db.rollback()
            raise
        except (CoachInvitationNotFound, CoachInvitationAlreadyUsed, CoachInvitationRevoked):
            await self.db.rollback()
            raise
        except Exception:
            await self.db.rollback()
            raise
        audit_log(
            action=COACH_INVITATION_ACCEPT,
            user_db_id=client_id,
            resource_type="coach_invitation",
            resource_id=invitation.id,
            client_ip=client_ip,
            meta={"coach_id": invitation.coach_id},
        )
        audit_log(
            action=COACH_RELATIONSHIP_CREATE,
            user_db_id=invitation.coach_id,
            resource_type="coach_client",
            resource_id=relationship.id,
            client_ip=client_ip,
            meta={"client_id": client_id},
        )
        return CoachClientResponse.model_validate(relationship)

    def _ensure_usable(self, invitation: CoachInvitation) -> None:
        if invitation.status == CoachInvitationStatus.ACCEPTED:
            raise CoachInvitationAlreadyUsed()
        if invitation.status == CoachInvitationStatus.REVOKED:
            raise CoachInvitationRevoked()
        if invitation.status == CoachInvitationStatus.EXPIRED or _as_utc(invitation.expires_at) <= _now():
            invitation.status = CoachInvitationStatus.EXPIRED
            raise CoachInvitationExpired()


class CoachRelationshipService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.clients = CoachClientRepository(db)

    async def list_clients(self, coach_id: int) -> list[CoachClientResponse]:
        return [CoachClientResponse.model_validate(item) for item in await self.clients.list_for_coach(coach_id)]

    async def get_client(self, coach_id: int, client_id: int) -> CoachClientDetailResponse:
        relationship = await self.clients.get_for_coach(coach_id, client_id, current_only=True)
        if not relationship or relationship.status in {CoachClientStatus.ARCHIVED, CoachClientStatus.REVOKED}:
            raise CoachClientRelationshipNotFound()
        client = relationship.client
        return CoachClientDetailResponse(
            **CoachClientResponse.model_validate(relationship).model_dump(),
            client_first_name=client.first_name,
            client_username=client.username,
        )

    async def update_client(self, coach_id: int, client_id: int, data: CoachClientUpdate, client_ip: str | None = None) -> CoachClientResponse:
        relationship = await self.clients.get_for_coach(coach_id, client_id, current_only=True)
        if not relationship or relationship.status in {CoachClientStatus.ARCHIVED, CoachClientStatus.REVOKED}:
            raise CoachClientRelationshipNotFound()
        requested_status = data.status
        if relationship.status == CoachClientStatus.REVOKED and requested_status not in (None, CoachClientStatus.REVOKED):
            raise CoachClientRelationshipNotFound()
        if requested_status is not None:
            allowed_transitions = {
                CoachClientStatus.ACTIVE: {CoachClientStatus.PAUSED, CoachClientStatus.ARCHIVED, CoachClientStatus.REVOKED},
                CoachClientStatus.PAUSED: {CoachClientStatus.ACTIVE, CoachClientStatus.ARCHIVED, CoachClientStatus.REVOKED},
                CoachClientStatus.ARCHIVED: set(),
                CoachClientStatus.REVOKED: set(),
            }
            if requested_status != relationship.status and requested_status not in allowed_transitions[relationship.status]:
                raise CoachClientRelationshipNotFound()
            relationship.status = requested_status
        if requested_status in {CoachClientStatus.ARCHIVED, CoachClientStatus.REVOKED}:
            relationship.ended_at = _now()
            relationship.archived_at = _now() if relationship.status == CoachClientStatus.ARCHIVED else None
        await self.db.commit()
        await self.db.refresh(relationship)
        audit_log(action=COACH_RELATIONSHIP_STATUS_CHANGE, user_db_id=coach_id, resource_type="coach_client", resource_id=relationship.id, client_ip=client_ip, meta={"status": relationship.status})
        return CoachClientResponse.model_validate(relationship)

    async def revoke_client(self, coach_id: int, client_id: int, client_ip: str | None = None) -> None:
        await self.update_client(coach_id, client_id, CoachClientUpdate(status="REVOKED"), client_ip)
