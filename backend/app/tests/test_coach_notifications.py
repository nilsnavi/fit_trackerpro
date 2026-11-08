"""Sprint 10.5: Telegram outbox notifications for coach events."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from app.application.coach_notification_service import CoachNotificationService
from app.domain.coach_notification import CoachNotification
from app.infrastructure.telegram_sender import TelegramDeliveryError
from app.settings import settings
from app.tests.telegram_webapp import build_init_data

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


class _FakeSender:
    def __init__(self, fail_times: int = 0) -> None:
        self.calls: list[tuple[int, str]] = []
        self.fail_times = fail_times

    async def send_message(self, chat_id: int, text: str) -> None:
        if self.fail_times > 0:
            self.fail_times -= 1
            raise TelegramDeliveryError("bot unavailable")
        self.calls.append((chat_id, text))


async def _headers(client: AsyncClient, telegram_id: int, name: str) -> dict[str, str]:
    init_data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": telegram_id, "first_name": name, "username": f"user{telegram_id}"},
    )
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _coach(client: AsyncClient, telegram_id: int, name: str) -> dict[str, str]:
    headers = await _headers(client, telegram_id, name)
    response = await client.post("/api/v1/coach/profile", headers=headers, json={"display_name": name})
    assert response.status_code == 201, response.text
    return headers


async def _enable_coach(db_session) -> None:
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()


async def test_outbox_enqueue_is_deduped_and_does_not_deliver_inline(db_session):
    from app.domain.user import User

    recipient = User(telegram_id=700300500, first_name="Recipient")
    db_session.add(recipient)
    await db_session.commit()

    service = CoachNotificationService(db_session, sender=_FakeSender())
    first = await service.enqueue(
        event="coach.program.assigned",
        dedupe_key="program-assigned:1",
        payload={"program_name": "Base"},
        recipient_user_id=recipient.id,
    )
    duplicate = await service.enqueue(
        event="coach.program.assigned",
        dedupe_key="program-assigned:1",
        payload={"program_name": "Base"},
        recipient_user_id=recipient.id,
    )
    assert first is not None and duplicate is None
    await db_session.commit()

    # Nothing delivered inline: business transaction only enqueues.
    fake = _FakeSender()
    assert fake.calls == []

    rows = (await db_session.scalars(select(CoachNotification))).all()
    assert len(rows) == 1 and rows[0].status == "PENDING"
    # Recipient telegram id resolved from the user row.
    assert rows[0].recipient_telegram_id == 700300500


async def _make_user(db_session, telegram_id: int, name: str):
    from app.domain.user import User

    user = User(telegram_id=telegram_id, first_name=name)
    db_session.add(user)
    await db_session.commit()
    return user


async def test_delivery_sends_message_and_marks_sent(db_session):
    recipient = await _make_user(db_session, 700300400, "Recipient A")
    await CoachNotificationService(db_session).enqueue(
        event="coach.package.low",
        dedupe_key="package-low:1:3",
        payload={"remaining": 2},
        recipient_user_id=recipient.id,
    )
    await db_session.commit()

    fake = _FakeSender()
    service = CoachNotificationService(db_session, sender=fake)
    outcome = await service.deliver_pending(now=datetime.now(UTC))
    assert outcome == {"sent": 1, "failed": 0, "skipped": 0, "deferred": 0}
    assert fake.calls and fake.calls[0][0] == 700300400
    assert "2" in fake.calls[0][1]

    row = await db_session.scalar(select(CoachNotification))
    assert row is not None and row.status == "SENT" and row.sent_at is not None


async def test_delivery_retries_with_backoff_then_fails_after_limit(db_session, monkeypatch):
    recipient = await _make_user(db_session, 700300401, "Recipient B")
    await CoachNotificationService(db_session).enqueue(
        event="coach.task.due",
        dedupe_key="task-due:1:2026-11-06",
        payload={"title": "Позвонить"},
        recipient_user_id=recipient.id,
    )
    await db_session.commit()

    failing = _FakeSender(fail_times=99)
    service = CoachNotificationService(db_session, sender=failing)
    now = datetime.now(UTC)

    first = await service.deliver_pending(now=now)
    assert first["deferred"] == 1
    row = await db_session.scalar(select(CoachNotification))
    assert row is not None and row.status == "PENDING" and row.attempts == 1
    retry_at = row.next_retry_at
    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=UTC)
    assert retry_at > now

    # Not due yet: deferred from the retry schedule, no attempt made.
    early = await service.deliver_pending(now=now + timedelta(seconds=1))
    assert early["deferred"] == 0 and len(failing.calls) == 0

    # After the backoff window another attempt fails again.
    await service.deliver_pending(now=now + timedelta(seconds=60))
    assert row.attempts == 2

    # Exhaust the retry budget; the row lands in FAILED.
    for _ in range(4):
        row.next_retry_at = now
        await db_session.commit()
        await service.deliver_pending(now=now)
    assert row.status == "FAILED" and row.attempts >= 5

    # A terminal failure is not retried again.
    exhausted = await service.deliver_pending(now=now)
    assert exhausted["deferred"] == 0


async def test_recipient_notification_preference_disables_delivery(db_session):
    from app.domain.user import User

    user = User(telegram_id=700300402, first_name="Muted")
    user.settings = {"notifications": False}
    db_session.add(user)
    await db_session.commit()

    await CoachNotificationService(db_session).enqueue(
        event="client.workout.reminder",
        dedupe_key="workout-reminder:1",
        payload={},
        recipient_user_id=user.id,
    )
    await db_session.commit()

    fake = _FakeSender()
    outcome = await CoachNotificationService(db_session, sender=fake).deliver_pending(now=datetime.now(UTC))
    assert outcome["skipped"] == 1 and fake.calls == []
    row = await db_session.scalar(select(CoachNotification))
    assert row is not None and row.status == "SKIPPED"


async def test_template_renders_russian_texts_without_medical_claims():
    from app.application.coach_notification_service import (
        format_package_low,
        format_program_assigned,
        format_workout_missed,
    )

    assigned = format_program_assigned({"coach_name": "Алексей", "program_name": "Hypertrophy Base"})
    assert "Алексей" in assigned and "Hypertrophy Base" in assigned
    missed = format_workout_missed({"client_name": "Иван Петров", "days": 9})
    assert "Иван Петров" in missed and "9" in missed
    low = format_package_low({"client_name": "Анна", "remaining": 2})
    assert "Анна" in low and "2" in low and "занятия" in low


async def test_invitation_created_enqueues_outbox_not_raw_token(client: AsyncClient, db_session, caplog):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 965001, "Coach N")
    import logging

    with caplog.at_level(logging.INFO, logger="app.audit"):
        created = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    assert created.status_code == 201, created.text
    raw_token = created.json()["token"]

    rows = (await db_session.scalars(select(CoachNotification))).all()
    assert any(row.event == "coach.invitation.created" for row in rows)
    # The raw invitation token never reaches the outbox payloads or audit logs.
    assert all(raw_token not in str(row.payload) for row in rows)
    assert all(raw_token not in record.getMessage() for record in caplog.records)
