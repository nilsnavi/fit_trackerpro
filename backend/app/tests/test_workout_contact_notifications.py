"""Emergency contacts hear about workout start/end from the server itself.

Before: ``notify_on_workout_start/end`` existed on the contact and the
``/notify/workout-*`` endpoints existed, but nothing ever called them — the flags
were promises nobody kept. Now the workout lifecycle endpoints trigger delivery.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.emergency_service import EmergencyService
from app.application.workout_contact_notifier import (
    PlannedDelivery,
    deliver_workout_messages,
)
from app.infrastructure.telegram_sender import TelegramDeliveryError

pytestmark = pytest.mark.asyncio

EMERGENCY = "/api/v1/system/emergency"


class FakeTelegramSender:
    def __init__(self) -> None:
        self.sent: list[tuple[int, str]] = []
        self.fail_for: set[int] = set()

    async def send_message(self, chat_id: int, text: str) -> None:
        if chat_id in self.fail_for:
            raise TelegramDeliveryError("chat not found")
        self.sent.append((chat_id, text))


@pytest_asyncio.fixture
def fake_sender(monkeypatch) -> FakeTelegramSender:
    sender = FakeTelegramSender()
    monkeypatch.setattr(
        "app.application.workout_contact_notifier.get_telegram_sender", lambda: sender
    )
    monkeypatch.setattr("app.application.emergency_service.get_telegram_sender", lambda: sender)
    return sender


async def _linked_contact(
    client: AsyncClient,
    db: AsyncSession,
    chat_id: int,
    *,
    start: bool,
    end: bool,
    name: str = "Мама",
) -> dict:
    created = await client.post(
        f"{EMERGENCY}/contact",
        json={
            "contact_name": name,
            "contact_username": f"contact{chat_id}",
            "notify_on_workout_start": start,
            "notify_on_workout_end": end,
        },
    )
    assert created.status_code == 201, created.text
    contact = created.json()
    code = (await client.post(f"{EMERGENCY}/contact/{contact['id']}/link-code")).json()["code"]
    await EmergencyService(db).link_contact_by_code(code, chat_id)
    return contact


async def _start(client: AsyncClient) -> int:
    response = await client.post(
        "/api/v1/workouts/start", json={"name": "Вечер", "type": "strength"}
    )
    assert response.status_code == 200, response.text
    return int(response.json()["id"])


def _complete_body(duration: int = 42) -> dict:
    return {
        "duration": duration,
        "exercises": [
            {
                "exercise_id": 11,
                "name": "Burpees",
                "sets_completed": [{"set_number": 1, "completed": True, "reps": 10}],
            }
        ],
    }


async def test_start_and_complete_message_opted_in_linked_contacts(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    await _linked_contact(authenticated_client, db_session, 5001, start=True, end=True)
    await _linked_contact(
        authenticated_client, db_session, 5002, start=False, end=False, name="Не подписан"
    )

    workout_id = await _start(authenticated_client)
    assert [chat for chat, _ in fake_sender.sent] == [5001]
    assert "начал(а) тренировку" in fake_sender.sent[0][1]
    assert "Сообщим, когда она закончится" in fake_sender.sent[0][1]

    fake_sender.sent.clear()
    completed = await authenticated_client.post(
        f"/api/v1/workouts/complete?workout_id={workout_id}", json=_complete_body(42)
    )
    assert completed.status_code == 200, completed.text
    assert fake_sender.sent == [(5001, fake_sender.sent[0][1])]
    assert "завершил(а) тренировку (42 мин)" in fake_sender.sent[0][1]


async def test_duplicate_completion_does_not_message_twice(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    await _linked_contact(authenticated_client, db_session, 5101, start=False, end=True)
    workout_id = await _start(authenticated_client)

    for _ in range(2):  # offline queue retry / double tap
        response = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}", json=_complete_body()
        )
        assert response.status_code == 200, response.text

    assert len(fake_sender.sent) == 1


async def test_start_message_does_not_promise_an_end_message_it_will_not_send(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    await _linked_contact(authenticated_client, db_session, 5201, start=True, end=False)

    await _start(authenticated_client)

    assert len(fake_sender.sent) == 1
    assert "Сообщим" not in fake_sender.sent[0][1]


async def test_cancelled_workout_closes_the_loop_once(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    await _linked_contact(authenticated_client, db_session, 5301, start=False, end=True)
    workout_id = await _start(authenticated_client)

    for _ in range(2):
        response = await authenticated_client.post(
            f"/api/v1/workouts/{workout_id}/cancel", json={}
        )
        assert response.status_code == 200, response.text

    assert len(fake_sender.sent) == 1
    assert "закончил(а) тренировку. Всё в порядке." in fake_sender.sent[0][1]


async def test_unlinked_contacts_are_skipped_and_delivery_errors_never_fail_the_workout(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    # Opted in but never linked the bot: nothing can be delivered.
    created = await authenticated_client.post(
        f"{EMERGENCY}/contact",
        json={"contact_name": "Без бота", "contact_username": "x", "notify_on_workout_start": True},
    )
    assert created.status_code == 201
    await _linked_contact(authenticated_client, db_session, 5401, start=True, end=False)
    fake_sender.fail_for = {5401}

    workout_id = await _start(authenticated_client)

    assert workout_id > 0
    assert fake_sender.sent == []


async def test_settings_report_auto_notify_once_a_contact_opts_in(
    authenticated_client: AsyncClient, db_session: AsyncSession, fake_sender: FakeTelegramSender
) -> None:
    contact = await _linked_contact(authenticated_client, db_session, 5501, start=False, end=False)
    settings = (await authenticated_client.get(f"{EMERGENCY}/settings")).json()
    assert settings["auto_notify_on_workout"] is False

    updated = await authenticated_client.put(
        f"{EMERGENCY}/contact/{contact['id']}", json={"notify_on_workout_end": True}
    )
    assert updated.status_code == 200, updated.text

    settings = (await authenticated_client.get(f"{EMERGENCY}/settings")).json()
    assert settings["auto_notify_on_workout"] is True


async def test_deliver_workout_messages_counts_only_accepted_messages() -> None:
    sender = FakeTelegramSender()
    sender.fail_for = {2}
    delivered = await deliver_workout_messages(
        sender,
        [PlannedDelivery(1, 1, "a"), PlannedDelivery(2, 2, "b"), PlannedDelivery(3, 3, "c")],
        event="workout_end",
        workout_id=7,
    )
    assert delivered == 2
    assert [chat for chat, _ in sender.sent] == [1, 3]


async def test_duplicate_username_is_a_conflict_not_a_server_error(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender
) -> None:
    body = {"contact_name": "Первый", "contact_username": "same_person"}
    assert (await authenticated_client.post(f"{EMERGENCY}/contact", json=body)).status_code == 201

    duplicate = await authenticated_client.post(
        f"{EMERGENCY}/contact", json={**body, "contact_name": "Второй"}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["code"] == "emergency_contact_conflict"

    other = await authenticated_client.post(
        f"{EMERGENCY}/contact", json={"contact_name": "Другой", "contact_username": "other_one"}
    )
    assert other.status_code == 201
    renamed = await authenticated_client.put(
        f"{EMERGENCY}/contact/{other.json()['id']}", json={"contact_username": "same_person"}
    )
    assert renamed.status_code == 409, renamed.text
    # The session is still usable after the rollback.
    listed = await authenticated_client.get(f"{EMERGENCY}/contact")
    assert listed.status_code == 200
