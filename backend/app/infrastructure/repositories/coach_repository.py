from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_invitation import CoachInvitation
from app.domain.coach_profile import CoachProfile
from app.domain.user_role import UserRole, UserRoleName
from app.infrastructure.repositories.base import SQLAlchemyRepository


class UserRoleRepository(SQLAlchemyRepository):
    async def has_role(self, user_id: int, role: UserRoleName) -> bool:
        return bool(await self.db.scalar(select(UserRole.id).where(UserRole.user_id == user_id, UserRole.role == role)))

    async def activate_coach(self, user_id: int) -> UserRole:
        record = UserRole(user_id=user_id, role=UserRoleName.COACH)
        self.add(record)
        await self.db.flush()
        return record


class CoachProfileRepository(SQLAlchemyRepository):
    async def get_by_user_id(self, user_id: int) -> CoachProfile | None:
        return await self.db.scalar(select(CoachProfile).where(CoachProfile.user_id == user_id))

    async def create(self, profile: CoachProfile) -> CoachProfile:
        self.add(profile)
        await self.db.flush()
        return profile


class CoachClientRepository(SQLAlchemyRepository):
    async def list_for_coach(self, coach_id: int) -> list[CoachClient]:
        result = await self.db.execute(
            select(CoachClient).where(CoachClient.coach_id == coach_id).order_by(CoachClient.created_at.desc())
        )
        return list(result.scalars())

    async def get_for_coach(self, coach_id: int, client_id: int, *, active_only: bool = False, lock: bool = False) -> CoachClient | None:
        statement = (
            select(CoachClient)
            .options(selectinload(CoachClient.client))
            .where(CoachClient.coach_id == coach_id, CoachClient.client_id == client_id)
        )
        if active_only:
            statement = statement.where(CoachClient.status == CoachClientStatus.ACTIVE)
        if lock:
            statement = statement.with_for_update()
        return await self.db.scalar(statement)

    async def count_active(self, coach_id: int) -> int:
        return int(await self.db.scalar(select(func.count(CoachClient.id)).where(CoachClient.coach_id == coach_id, CoachClient.status == CoachClientStatus.ACTIVE)) or 0)

    async def create(self, relationship: CoachClient) -> CoachClient:
        self.add(relationship)
        await self.db.flush()
        return relationship


class CoachInvitationRepository(SQLAlchemyRepository):
    async def list_for_coach(self, coach_id: int) -> list[CoachInvitation]:
        result = await self.db.execute(
            select(CoachInvitation).where(CoachInvitation.coach_id == coach_id).order_by(CoachInvitation.created_at.desc())
        )
        return list(result.scalars())

    async def get_for_coach(self, coach_id: int, invitation_id: str, *, lock: bool = False) -> CoachInvitation | None:
        statement = select(CoachInvitation).where(
            CoachInvitation.id == invitation_id, CoachInvitation.coach_id == coach_id
        )
        if lock:
            statement = statement.with_for_update()
        return await self.db.scalar(statement)

    async def get_by_hash(self, token_hash: str, *, lock: bool = False) -> CoachInvitation | None:
        statement = select(CoachInvitation).where(CoachInvitation.token_hash == token_hash)
        if lock:
            statement = statement.with_for_update()
        return await self.db.scalar(statement)

    async def create(self, invitation: CoachInvitation) -> CoachInvitation:
        self.add(invitation)
        await self.db.flush()
        return invitation
