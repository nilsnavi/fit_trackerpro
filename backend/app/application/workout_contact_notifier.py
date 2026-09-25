"""Tell emergency contacts that a workout started or finished (server-side trigger).

The contact opts in per event (``notify_on_workout_start`` / ``notify_on_workout_end``)
and only receives anything after linking a Telegram chat with the bot.

Why on the server: the workout lifecycle endpoints are the single source of truth —
the message goes out even if the Mini App was closed right after "Finish" or the
completion arrived later from the offline queue, and duplicate completions (retries,
idempotent replays) never reach this code.

Delivery rules:

* notifications are best effort — a failure here must never fail or slow down the
  workout request, so everything is caught and logged;
* the contact list is read inside the request (one indexed query), but the Bot API
  calls are handed to ``schedule`` (FastAPI ``BackgroundTasks.add_task``) and run
  after the response is sent.
"""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.emergency_contact import EmergencyContact
from app.domain.user import User
from app.infrastructure.repositories.emergency_repository import EmergencyRepository
from app.infrastructure.telegram_sender import TelegramSender, get_telegram_sender

logger = logging.getLogger(__name__)

WorkoutEvent = Literal["workout_start", "workout_end"]

# ``BackgroundTasks.add_task`` compatible: schedule(func, *args).
Scheduler = Callable[..., Any]


def display_name(user: User | None) -> str:
    if user is None:
        return "Пользователь"
    return user.first_name or user.username or "Пользователь"


def workout_started_message(
    user_name: str,
    *,
    estimated_duration: int | None = None,
    promise_end_message: bool = True,
) -> str:
    duration = f" (примерно {estimated_duration} мин)" if estimated_duration else ""
    follow_up = " Сообщим, когда она закончится." if promise_end_message else ""
    return f"🏃 {user_name} начал(а) тренировку{duration}.{follow_up}"


def workout_finished_message(
    user_name: str,
    *,
    duration: int | None,
    completed_successfully: bool = True,
) -> str:
    verb = "завершил(а)" if completed_successfully else "закончил(а)"
    duration_str = f" ({duration} мин)" if duration else ""
    return f"✅ {user_name} {verb} тренировку{duration_str}. Всё в порядке."


@dataclass(frozen=True, slots=True)
class PlannedDelivery:
    contact_id: int
    chat_id: int
    text: str


async def deliver_workout_messages(
    sender: TelegramSender,
    deliveries: Sequence[PlannedDelivery],
    *,
    event: WorkoutEvent,
    workout_id: int,
) -> int:
    """Send every planned message; returns how many the Bot API accepted."""
    delivered = 0
    for item in deliveries:
        try:
            await sender.send_message(item.chat_id, item.text)
        except Exception as exc:  # one broken chat must not block the others
            logger.warning(
                "Workout %s notification for workout %s to contact %s failed: %s",
                event,
                workout_id,
                item.contact_id,
                exc,
            )
            continue
        delivered += 1
    logger.info(
        "Workout %s notification for workout %s: %s/%s delivered",
        event,
        workout_id,
        delivered,
        len(deliveries),
    )
    return delivered


class WorkoutContactNotifier:
    """Plans and dispatches workout start/end messages for one request."""

    def __init__(
        self,
        db: AsyncSession,
        schedule: Scheduler | None = None,
        sender: TelegramSender | None = None,
    ) -> None:
        self.repository = EmergencyRepository(db)
        self._schedule = schedule
        self._sender = sender

    @property
    def sender(self) -> TelegramSender:
        if self._sender is None:
            self._sender = get_telegram_sender()
        return self._sender

    async def workout_started(self, *, user_id: int, workout_id: int) -> None:
        await self._safely(
            "workout_start",
            workout_id,
            lambda: self._plan_started(user_id=user_id),
        )

    async def workout_finished(
        self,
        *,
        user_id: int,
        workout_id: int,
        duration: int | None,
        completed_successfully: bool = True,
    ) -> None:
        await self._safely(
            "workout_end",
            workout_id,
            lambda: self._plan_finished(
                user_id=user_id,
                duration=duration,
                completed_successfully=completed_successfully,
            ),
        )

    # ------------------------------------------------------------------
    async def _plan_started(self, *, user_id: int) -> list[PlannedDelivery]:
        contacts = _linked(await self.repository.list_contacts_for_workout_start(user_id=user_id))
        if not contacts:
            return []
        name = display_name(await self.repository.get_contact_owner(user_id))
        return [
            PlannedDelivery(
                contact_id=contact.id,
                chat_id=int(contact.telegram_chat_id),  # type: ignore[arg-type]
                # Only promise a follow-up to contacts that will actually get it.
                text=workout_started_message(
                    name, promise_end_message=bool(contact.notify_on_workout_end)
                ),
            )
            for contact in contacts
        ]

    async def _plan_finished(
        self, *, user_id: int, duration: int | None, completed_successfully: bool
    ) -> list[PlannedDelivery]:
        contacts = _linked(await self.repository.list_contacts_for_workout_end(user_id=user_id))
        if not contacts:
            return []
        name = display_name(await self.repository.get_contact_owner(user_id))
        text = workout_finished_message(
            name, duration=duration, completed_successfully=completed_successfully
        )
        return [
            PlannedDelivery(
                contact_id=contact.id,
                chat_id=int(contact.telegram_chat_id),  # type: ignore[arg-type]
                text=text,
            )
            for contact in contacts
        ]

    async def _safely(
        self,
        event: WorkoutEvent,
        workout_id: int,
        plan: Callable[[], Awaitable[list[PlannedDelivery]]],
    ) -> None:
        try:
            deliveries = await plan()
            if not deliveries:
                return
            if self._schedule is not None:
                self._schedule(
                    deliver_workout_messages,
                    self.sender,
                    deliveries,
                    event=event,
                    workout_id=workout_id,
                )
            else:
                await deliver_workout_messages(
                    self.sender, deliveries, event=event, workout_id=workout_id
                )
        except Exception:
            logger.exception(
                "Could not dispatch %s notification for workout %s", event, workout_id
            )


def _linked(contacts: Sequence[EmergencyContact]) -> list[EmergencyContact]:
    """Only contacts that linked a chat are reachable (Bot API can't cold-message)."""
    return [c for c in contacts if c.telegram_chat_id is not None]
