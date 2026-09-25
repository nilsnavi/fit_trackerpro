from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.workout_contact_notifier import (
    workout_finished_message,
    workout_started_message,
)
from app.domain.emergency_contact import EmergencyContact
from app.domain.exceptions import EmergencyNotFoundError, EmergencyValidationError
from app.domain.user import User
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.emergency_repository import EmergencyRepository
from app.infrastructure.telegram_sender import (
    TelegramDeliveryError,
    TelegramSender,
    get_telegram_sender,
)
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactLinkCodeResponse,
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
from app.settings import settings

logger = logging.getLogger(__name__)

# One-time codes are short enough to type but long enough not to be guessable.
_LINK_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/O/1/l/i confusion
_LINK_CODE_LENGTH = 10

_UNLINKED_REASON = (
    "Контакт не подключён к боту — уведомление не доставлено. "
    "Попросите его открыть бота и отправить код приглашения."
)


def _display_name(user: User) -> str:
    return user.first_name or user.username or "User"


def _new_link_code() -> str:
    return "".join(secrets.choice(_LINK_CODE_ALPHABET) for _ in range(_LINK_CODE_LENGTH))


@dataclass(slots=True)
class ContactLinkResult:
    """Outcome of a contact linking their Telegram account to a record."""

    contact_id: int
    contact_name: str
    owner_name: str
    already_linked: bool


class EmergencyService:
    def __init__(self, db: AsyncSession, sender: TelegramSender | None = None) -> None:
        self.repository = EmergencyRepository(db)
        self.db = db
        self._sender = sender

    @property
    def sender(self) -> TelegramSender:
        """Resolved lazily so tests can inject a fake sender per instance."""
        if self._sender is None:
            self._sender = get_telegram_sender()
        return self._sender

    # ------------------------------------------------------------------
    # Contacts
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # Linking a contact's Telegram account (real delivery channel)
    # ------------------------------------------------------------------
    async def issue_link_code(self, user_id: int, contact_id: int) -> EmergencyContactLinkCodeResponse:
        """Return the invite code the contact sends to the bot to get linked.

        Every call rotates the code: an old code that leaked (a screenshot, a
        forwarded message) must not be able to hijack the delivery channel.
        """
        contact = await self.repository.get_contact(user_id=user_id, contact_id=contact_id)
        if not contact:
            raise EmergencyNotFoundError("Emergency contact not found")

        contact.link_code = _new_link_code()
        contact = await self.repository.update_contact(contact)

        code = contact.link_code or ""
        command = f"/link {code}" if code else ""
        username = (settings.TELEGRAM_BOT_USERNAME or "").strip()
        deep_link = (
            f"https://t.me/{username}?start=link_{code}" if username and code else None
        )
        return EmergencyContactLinkCodeResponse(
            contact_id=contact.id,
            contact_name=contact.contact_name,
            code=code,
            command=command,
            deep_link=deep_link,
            is_linked=contact.is_linked,
        )

    async def unlink_contact(self, user_id: int, contact_id: int) -> EmergencyContactResponse:
        """Drop the delivery channel, e.g. when the contact changes accounts."""
        contact = await self.repository.get_contact(user_id=user_id, contact_id=contact_id)
        if not contact:
            raise EmergencyNotFoundError("Emergency contact not found")
        contact.telegram_chat_id = None
        contact.link_code = None
        contact.linked_at = None
        contact = await self.repository.update_contact(contact)
        return EmergencyContactResponse.model_validate(contact, from_attributes=True)

    async def link_contact_by_code(self, link_code: str, chat_id: int) -> ContactLinkResult:
        """Bind an incoming Telegram chat to the contact holding ``link_code``.

        Called from the bot when someone sends ``/link <code>``. Raises
        ``EmergencyValidationError`` with a message safe to show in the chat.
        """
        code = (link_code or "").strip().lower()
        if not code:
            raise EmergencyValidationError("Не указан код приглашения. Отправьте /link <код>.")

        contact = await self.repository.get_contact_by_link_code(code)
        if not contact:
            raise EmergencyValidationError(
                "Код не найден или уже использован. Попросите близкого сгенерировать новый."
            )

        if contact.telegram_chat_id == chat_id:
            return ContactLinkResult(
                contact_id=contact.id,
                contact_name=contact.contact_name,
                owner_name=await self._owner_name(contact.user_id),
                already_linked=True,
            )

        owner = await self.repository.get_contact_owner(contact.user_id)
        owner_telegram_id = getattr(owner, "telegram_id", None)
        if owner_telegram_id is not None and int(owner_telegram_id) == int(chat_id):
            raise EmergencyValidationError(
                "Вы не можете быть своим экстренным контактом — попросите близкого открыть ссылку."
            )

        contact.telegram_chat_id = chat_id
        contact.linked_at = datetime.now(UTC)
        await self.repository.update_contact(contact)

        return ContactLinkResult(
            contact_id=contact.id,
            contact_name=contact.contact_name,
            owner_name=_display_name(owner) if owner else "пользователя",
            already_linked=False,
        )

    async def _owner_name(self, user_id: int) -> str:
        owner = await self.repository.get_contact_owner(user_id)
        return _display_name(owner) if owner else "пользователя"

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------
    def _build_emergency_message(
        self, user_name: str, notify_data: EmergencyNotifyRequest
    ) -> str:
        location_str = f"\n📍 Место: {notify_data.location}" if notify_data.location else ""
        custom = f"\n💬 Сообщение: {notify_data.message}" if notify_data.message else ""
        return (
            "🚨 ЭКСТРЕННОЕ УВЕДОМЛЕНИЕ\n"
            f"{user_name} нажал(а) «Мне плохо» в FitTracker Pro.{custom}{location_str}\n\n"
            "Пожалуйста, свяжитесь с ним/ней немедленно."
        )

    async def _deliver(
        self,
        contact: EmergencyContact,
        message: str,
    ) -> NotificationResult:
        """Send one message and report exactly what happened."""
        if contact.telegram_chat_id is None:
            return NotificationResult(
                contact_id=contact.id,
                contact_name=contact.contact_name,
                method="unlinked",
                success=False,
                error=_UNLINKED_REASON,
            )
        try:
            await self.sender.send_message(contact.telegram_chat_id, message)
        except TelegramDeliveryError as exc:
            logger.warning(
                "Emergency message to contact %s (chat %s) failed: %s",
                contact.id,
                contact.telegram_chat_id,
                exc,
            )
            return NotificationResult(
                contact_id=contact.id,
                contact_name=contact.contact_name,
                method="telegram",
                success=False,
                error=f"Ошибка доставки: {exc}",
            )
        except Exception as exc:  # defensive: a sender bug must not fake success
            logger.exception("Unexpected error sending to contact %s", contact.id)
            return NotificationResult(
                contact_id=contact.id,
                contact_name=contact.contact_name,
                method="telegram",
                success=False,
                error=f"Ошибка доставки: {exc}",
            )
        return NotificationResult(
            contact_id=contact.id,
            contact_name=contact.contact_name,
            method="telegram",
            success=True,
            error=None,
        )

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

        message = self._build_emergency_message(user_name, notify_data)

        results: list[NotificationResult] = []
        for contact in contacts:
            results.append(await self._deliver(contact, message))
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        severity_value = (
            notify_data.severity.value
            if hasattr(notify_data.severity, "value")
            else str(notify_data.severity)
        )
        return EmergencyNotifyResponse(
            notified_at=datetime.now(UTC),
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

    async def _notify_contacts(
        self,
        contacts: list[EmergencyContact],
        message: str,
        *,
        nothing_configured: str,
    ) -> EmergencyWorkoutNotifyResponse:
        if not contacts:
            return EmergencyWorkoutNotifyResponse(message=nothing_configured)

        results = [await self._deliver(contact, message) for contact in contacts]
        delivered = sum(1 for r in results if r.success)
        failed = len(results) - delivered

        if delivered == 0:
            summary = (
                f"Уведомления не доставлены: ни один из {len(results)} контактов не подключён к боту. "
                "Попросите их отправить боту код приглашения."
            )
        elif failed:
            summary = f"Уведомление доставлено {delivered} из {len(results)} контактов."
        else:
            summary = f"Уведомление доставлено всем контактам ({delivered})."

        return EmergencyWorkoutNotifyResponse(
            message=summary,
            contacts_notified=delivered,
            contacts_failed=failed,
            preview=message,
        )

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
        message = workout_started_message(user_name, estimated_duration=estimated_duration)
        return await self._notify_contacts(
            list(contacts),
            message,
            nothing_configured="Нет контактов с включённым уведомлением о начале тренировки",
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
        message = workout_finished_message(
            user_name, duration=duration, completed_successfully=completed_successfully
        )
        return await self._notify_contacts(
            list(contacts),
            message,
            nothing_configured="Нет контактов с включённым уведомлением об окончании тренировки",
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
            # The server messages contacts on workout start/end by itself (see
            # WorkoutContactNotifier) — true when any active contact opted in.
            auto_notify_on_workout=any(
                c.is_active and (c.notify_on_workout_start or c.notify_on_workout_end)
                for c in contacts
            ),
            emergency_timeout_minutes=60,
            # The app never transmits location on its own: it is only included in
            # an alert when the user explicitly passes it.
            location_sharing=False,
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
            event_id=f"evt_{user_id}_{int(datetime.now(UTC).timestamp())}",
        )
