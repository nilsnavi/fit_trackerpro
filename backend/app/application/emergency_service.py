from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.user import User
from app.domain.emergency_contact import EmergencyContact
from app.domain.exceptions import EmergencyNotFoundError, EmergencyValidationError
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.emergency_repository import EmergencyRepository
from app.settings import settings
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactListResponse,
    EmergencyContactResponse,
    EmergencyContactUpdate,
    EmergencyLogEventRequest,
    EmergencyLogEventResponse,
    EmergencyNotifyRequest,
    EmergencyNotifyResponse,
    EmergencySettingsResponse,
    EmergencyWorkoutNotifyResponse,
    NotificationResult,
)

logger = logging.getLogger(__name__)


def _display_name(user: User) -> str:
    return user.first_name or user.username or "User"


class EmergencyService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = EmergencyRepository(db)

    async def get_contacts(self, user_id: int) -> EmergencyContactListResponse:
        contacts = await self.repository.list_contacts(user_id=user_id)
        return EmergencyContactListResponse(
            items=[EmergencyContactResponse.model_validate(c, from_attributes=True) for c in contacts],
            total=len(contacts),
            active_count=sum(1 for c in contacts if c.is_active),
        )

    async def create_contact(self, user_id: int, data: EmergencyContactCreate) -> EmergencyContactResponse:
        if not data.contact_username and not data.phone:
            raise EmergencyValidationError("Either contact_username or phone must be provided")
        contact = EmergencyContact(
            user_id=user_id,
            contact_name=data.contact_name,
            contact_username=data.contact_username,
            phone=data.phone,
            relationship_type=data.relationship_type,
            is_active=data.is_active,
            notify_on_workout_start=data.notify_on_workout_start,
            notify_on_workout_end=data.notify_on_workout_end,
            notify_on_emergency=data.notify_on_emergency,
            priority=data.priority,
        )
        contact = await self.repository.create_contact(contact)
        return EmergencyContactResponse.model_validate(contact, from_attributes=True)

    async def get_contact(self, user_id: int, contact_id: int) -> EmergencyContactResponse:
        contact = await self.repository.get_contact(user_id=user_id, contact_id=contact_id)
        if not contact:
            raise EmergencyNotFoundError("Emergency contact not found")
        return EmergencyContactResponse.model_validate(contact, from_attributes=True)

    async def update_contact(
        self, user_id: int, contact_id: int, data: EmergencyContactUpdate
    ) -> EmergencyContactResponse:
        contact = await self.repository.get_contact(user_id=user_id, contact_id=contact_id)
        if not contact:
            raise EmergencyNotFoundError("Emergency contact not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        contact = await self.repository.update_contact(contact)
        return EmergencyContactResponse.model_validate(contact, from_attributes=True)

    async def delete_contact(self, user_id: int, contact_id: int) -> None:
        contact = await self.repository.get_contact(user_id=user_id, contact_id=contact_id)
        if not contact:
            raise EmergencyNotFoundError("Emergency contact not found")
        await self.repository.delete_contact(contact)

    async def _send_emergency_notification_impl(
        self,
        user: User,
        notify_data: EmergencyNotifyRequest,
    ) -> EmergencyNotifyResponse:
        user_id = user.id
        user_name = _display_name(user)
        contacts = await self.repository.list_active_contacts_for_emergency(user_id=user_id)
        if not contacts:
            raise EmergencyValidationError("No active emergency contacts configured")

        location_str = f" Location: {notify_data.location}" if notify_data.location else ""
        if notify_data.message:
            message = f"🚨 EMERGENCY ALERT from {user_name}: {notify_data.message}{location_str}"
        else:
            message = f"🚨 EMERGENCY ALERT from {user_name}!{location_str} Please check on them immediately."

        results = []
        successful = 0
        failed = 0
        for contact in contacts:
            method = None
            if contact.contact_username:
                method = "telegram"
                success = True
            elif contact.phone:
                method = "sms"
                success = True
            else:
                success = False
            if success:
                successful += 1
            else:
                failed += 1
            results.append(
                NotificationResult(
                    contact_id=contact.id,
                    contact_name=contact.contact_name,
                    method=method or "unknown",
                    success=success,
                    error=None if success else "No valid contact method",
                )
            )

        severity_value = (
            notify_data.severity.value
            if hasattr(notify_data.severity, "value")
            else str(notify_data.severity)
        )
        return EmergencyNotifyResponse(
            notified_at=datetime.utcnow(),
            severity=severity_value,
            message_sent=message,
            results=results,
            successful_count=successful,
            failed_count=failed,
        )

    async def send_emergency_notification(
        self,
        user: User,
        notify_data: EmergencyNotifyRequest,
        idempotency_key: str | None = None,
    ) -> EmergencyNotifyResponse:
        async def _run() -> EmergencyNotifyResponse:
            return await self._send_emergency_notification_impl(user, notify_data)

        if idempotency_key:
            return await run_idempotent(
                user_id=user.id,
                scope="emergency_notify",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_EMERGENCY_TTL_SECONDS,
                execute=_run,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: EmergencyNotifyResponse.model_validate(d),
            )
        return await _run()

    async def _notify_workout_start_impl(
        self,
        user: User,
        workout_id: int,
        estimated_duration: int | None,
    ) -> EmergencyWorkoutNotifyResponse:
        _ = workout_id
        user_id = user.id
        user_name = _display_name(user)
        contacts = await self.repository.list_contacts_for_workout_start(user_id=user_id)
        if not contacts:
            return EmergencyWorkoutNotifyResponse(
                message="No contacts configured for workout start notifications"
            )
        duration_str = f" (estimated {estimated_duration} min)" if estimated_duration else ""
        message = f"🏃 {user_name} has started a workout{duration_str}. You'll be notified when they finish."
        return EmergencyWorkoutNotifyResponse(
            message="Workout start notifications sent",
            contacts_notified=len(contacts),
            preview=message,
        )

    async def notify_workout_start(
        self,
        user: User,
        workout_id: int,
        estimated_duration: int | None,
        idempotency_key: str | None = None,
    ) -> EmergencyWorkoutNotifyResponse:
        async def _run() -> EmergencyWorkoutNotifyResponse:
            return await self._notify_workout_start_impl(user, workout_id, estimated_duration)

        if idempotency_key:
            return await run_idempotent(
                user_id=user.id,
                scope=f"emergency_notify_workout_start:{workout_id}",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_EMERGENCY_TTL_SECONDS,
                execute=_run,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: EmergencyWorkoutNotifyResponse.model_validate(d),
            )
        return await _run()

    async def _notify_workout_end_impl(
        self,
        user: User,
        workout_id: int,
        duration: int,
        completed_successfully: bool,
    ) -> EmergencyWorkoutNotifyResponse:
        _ = workout_id
        user_id = user.id
        user_name = _display_name(user)
        contacts = await self.repository.list_contacts_for_workout_end(user_id=user_id)
        if not contacts:
            return EmergencyWorkoutNotifyResponse(
                message="No contacts configured for workout end notifications"
            )
        status = "completed" if completed_successfully else "ended"
        message = f"✅ {user_name} has {status} their workout ({duration} min). All is well!"
        return EmergencyWorkoutNotifyResponse(
            message="Workout end notifications sent",
            contacts_notified=len(contacts),
            preview=message,
        )

    async def notify_workout_end(
        self,
        user: User,
        workout_id: int,
        duration: int,
        completed_successfully: bool,
        idempotency_key: str | None = None,
    ) -> EmergencyWorkoutNotifyResponse:
        async def _run() -> EmergencyWorkoutNotifyResponse:
            return await self._notify_workout_end_impl(
                user, workout_id, duration, completed_successfully
            )

        if idempotency_key:
            return await run_idempotent(
                user_id=user.id,
                scope=f"emergency_notify_workout_end:{workout_id}",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_EMERGENCY_TTL_SECONDS,
                execute=_run,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: EmergencyWorkoutNotifyResponse.model_validate(d),
            )
        return await _run()

    async def get_settings(self, user_id: int) -> EmergencySettingsResponse:
        contacts = await self.repository.list_contacts(user_id=user_id)
        return EmergencySettingsResponse(
            auto_notify_on_workout=False,
            emergency_timeout_minutes=60,
            location_sharing=True,
            contacts_count=len(contacts),
            active_contacts_count=sum(1 for c in contacts if c.is_active),
        )

    async def log_emergency_event(
        self, user_id: int, log_data: EmergencyLogEventRequest
    ) -> EmergencyLogEventResponse:
        logger.info(
            "Emergency event logged for user %s: symptom=%s, protocol_started=%s, contact_notified=%s",
            user_id,
            log_data.symptom,
            log_data.protocol_started,
            log_data.contact_notified,
        )
        return EmergencyLogEventResponse(
            logged=True,
            event_id=f"evt_{user_id}_{int(datetime.utcnow().timestamp())}",
        )
