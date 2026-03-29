from __future__ import annotations

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.emergency_contact import EmergencyContact


class EmergencyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_contacts(self, user_id: int):
        result = await self.db.execute(
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .order_by(EmergencyContact.priority, desc(EmergencyContact.created_at))
        )
        return result.scalars().all()

    async def get_contact(self, user_id: int, contact_id: int):
        result = await self.db.execute(
            select(EmergencyContact).where(
                and_(
                    EmergencyContact.id == contact_id,
                    EmergencyContact.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_active_contacts_for_emergency(self, user_id: int):
        result = await self.db.execute(
            select(EmergencyContact)
            .where(
                and_(
                    EmergencyContact.user_id == user_id,
                    EmergencyContact.is_active == True,  # noqa: E712
                    EmergencyContact.notify_on_emergency == True,  # noqa: E712
                )
            )
            .order_by(EmergencyContact.priority)
        )
        return result.scalars().all()

    async def list_contacts_for_workout_start(self, user_id: int):
        result = await self.db.execute(
            select(EmergencyContact).where(
                and_(
                    EmergencyContact.user_id == user_id,
                    EmergencyContact.is_active == True,  # noqa: E712
                    EmergencyContact.notify_on_workout_start == True,  # noqa: E712
                )
            )
        )
        return result.scalars().all()

    async def list_contacts_for_workout_end(self, user_id: int):
        result = await self.db.execute(
            select(EmergencyContact).where(
                and_(
                    EmergencyContact.user_id == user_id,
                    EmergencyContact.is_active == True,  # noqa: E712
                    EmergencyContact.notify_on_workout_end == True,  # noqa: E712
                )
            )
        )
        return result.scalars().all()
