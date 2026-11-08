from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coach_notification import CoachNotification, CoachNotificationStatus
from app.infrastructure.telegram_sender import TelegramDeliveryError, TelegramSender

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BASE_RETRY_SECONDS = 30
MAX_RETRY_SECONDS = 3600


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _retry_delay(attempts: int) -> int:
    """Exponential backoff in seconds, capped at one hour."""
    return min(BASE_RETRY_SECONDS * (2 ** max(0, attempts - 1)), MAX_RETRY_SECONDS)


def format_invitation_created(payload: dict) -> str:
    coach_name = payload.get("coach_name") or "Тренер"
    return (
        f"{coach_name} пригласил вас подключиться в FitTrack Coach.\n"
        "Откройте приложение, чтобы принять приглашение."
    )


def format_program_assigned(payload: dict) -> str:
    coach_name = payload.get("coach_name") or "Тренер"
    program_name = payload.get("program_name") or "программу"
    message = payload.get("coach_message")
    text = f"{coach_name} назначил вам новую программу:\n{program_name}\n\nОткрыть программу"
    if message:
        text = f"{coach_name} назначил вам новую программу:\n{program_name}\n\n«{message}»\n\nОткрыть программу"
    return text


def format_workout_missed(payload: dict) -> str:
    client_name = payload.get("client_name") or "Клиент"
    days = payload.get("days", 7)
    return f"{client_name} не выполнял запланированную тренировку {days} дн."


def format_package_low(payload: dict) -> str:
    client_name = payload.get("client_name") or "Клиент"
    remaining = payload.get("remaining", 0)
    sessions = "занятие" if remaining == 1 else "занятия"
    return f"У {client_name} осталось {remaining} {sessions}."


def format_package_expired(payload: dict) -> str:
    client_name = payload.get("client_name") or "Клиент"
    return f"Пакет клиента {client_name} истёк."


def format_task_due(payload: dict) -> str:
    title = payload.get("title") or "Задача"
    return f"Задача на сегодня: {title}."


def format_client_workout_reminder(payload: dict) -> str:
    return "Пора на тренировку! Откройте назначенную программу."


_FORMATTERS = {
    "coach.invitation.created": format_invitation_created,
    "coach.program.assigned": format_program_assigned,
    "coach.workout.missed": format_workout_missed,
    "coach.package.low": format_package_low,
    "coach.package.expired": format_package_expired,
    "coach.task.due": format_task_due,
    "client.workout.reminder": format_client_workout_reminder,
}


class CoachNotificationService:
    """Transactional outbox for Telegram delivery (Sprint 10.5).

    Business services call :meth:`enqueue` inside their own transaction; delivery
    happens separately, so a Telegram failure never rolls back business state.
    """

    def __init__(self, db: AsyncSession, sender: TelegramSender | None = None) -> None:
        self.db = db
        self._sender = sender

    @property
    def sender(self) -> TelegramSender:
        if self._sender is None:
            from app.infrastructure.telegram_sender import get_telegram_sender

            self._sender = get_telegram_sender()
        return self._sender

    # ------------------------------------------------------------------
    # Enqueue (inside caller's transaction; never delivers here)
    # ------------------------------------------------------------------
    async def enqueue(
        self,
        *,
        event: str,
        dedupe_key: str,
        payload: dict,
        recipient_user_id: int | None = None,
        recipient_telegram_id: int | None = None,
    ) -> CoachNotification | None:
        """Insert one outbox row; duplicate dedupe keys are silently ignored."""
        existing = await self.db.scalar(
            select(CoachNotification).where(CoachNotification.dedupe_key == dedupe_key)
        )
        if existing is not None:
            return None
        if recipient_telegram_id is None and recipient_user_id is not None:
            from app.domain.user import User

            recipient_telegram_id = await self.db.scalar(
                select(User.telegram_id).where(User.id == recipient_user_id)
            )
        notification = CoachNotification(
            event=event,
            dedupe_key=dedupe_key,
            payload=payload,
            recipient_user_id=recipient_user_id,
            recipient_telegram_id=recipient_telegram_id,
        )
        self.db.add(notification)
        try:
            await self.db.flush()
        except IntegrityError:
            # A concurrent writer won the dedupe race; the notification already exists.
            await self.db.rollback()
            return None
        return notification

    # ------------------------------------------------------------------
    # Delivery
    # ------------------------------------------------------------------
    async def deliver_pending(
        self,
        *,
        limit: int = 20,
        now: datetime | None = None,
        sender: TelegramSender | None = None,
    ) -> dict[str, int]:
        """Deliver due notifications with retry/backoff; returns outcome counters."""
        now = _normalize_dt(now) or _now()
        rows = (
            await self.db.scalars(
                select(CoachNotification)
                .where(
                    CoachNotification.status.in_(("PENDING", "FAILED")),
                    CoachNotification.next_retry_at.is_(None) | (CoachNotification.next_retry_at <= now),
                )
                .order_by(CoachNotification.created_at, CoachNotification.id)
                .limit(max(1, limit))
                .with_for_update(skip_locked=True),
            )
        ).all()

        outcome = {"sent": 0, "failed": 0, "skipped": 0, "deferred": 0}
        sender = sender or self.sender
        for notification in rows:
            chat_id = notification.recipient_telegram_id
            formatter = _FORMATTERS.get(notification.event)
            text = formatter(notification.payload) if formatter else ""
            if chat_id is None or not text:
                notification.status = CoachNotificationStatus.SKIPPED.value
                notification.last_error = "missing chat id or template" if chat_id is not None else "missing chat id"
                outcome["skipped"] += 1
                continue
            if not await self._notifications_enabled(notification.recipient_user_id):
                notification.status = CoachNotificationStatus.SKIPPED.value
                notification.last_error = "recipient disabled notifications"
                outcome["skipped"] += 1
                continue
            try:
                await sender.send_message(chat_id=int(chat_id), text=text)
            except TelegramDeliveryError as exc:
                notification.attempts += 1
                notification.last_error = str(exc)[:500]
                if notification.attempts >= MAX_ATTEMPTS:
                    notification.status = CoachNotificationStatus.FAILED.value
                    notification.next_retry_at = None
                    outcome["failed"] += 1
                else:
                    notification.status = CoachNotificationStatus.PENDING.value
                    notification.next_retry_at = now + timedelta(seconds=_retry_delay(notification.attempts))
                    outcome["deferred"] += 1
                continue
            notification.status = CoachNotificationStatus.SENT.value
            notification.sent_at = now
            notification.next_retry_at = None
            notification.last_error = None
            outcome["sent"] += 1
        await self.db.commit()
        return outcome

    async def _notifications_enabled(self, user_id: int | None) -> bool:
        if user_id is None:
            return True
        from app.domain.user import User

        user = await self.db.scalar(select(User).where(User.id == user_id))
        if user is None:
            return False
        settings_map = user.settings or {}
        return bool(settings_map.get("notifications", True))
