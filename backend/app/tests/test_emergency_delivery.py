"""Emergency notifications must report what actually happened (WS1-13).

History: ``_send_emergency_notification_impl`` counted a contact as successfully
notified as soon as it had a username or a phone number, without sending
anything — the Mini App then told the user the call for help was sent. These
tests pin the honest contract:

* a contact is reachable only after linking a Telegram chat (``telegram_chat_id``);
* undelivered contacts produce ``success=False`` with a reason;
* delivery failures from the Bot API are surfaced, never swallowed.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.emergency_service import EmergencyService
from app.domain.exceptions import EmergencyValidationError
from app.domain.user import User
from app.infrastructure.telegram_sender import TelegramDeliveryError
from app.settings import settings

pytestmark = pytest.mark.asyncio

EMERGENCY = "/api/v1/system/emergency"


class FakeTelegramSender:
    """Records outgoing messages; chat ids in ``fail_for`` raise."""

    def __init__(self, fail_for: tuple[int, ...] = ()) -> None:
        self.fail_for = set(fail_for)
        self.sent: list[tuple[int, str]] = []

    async def send_message(self, chat_id: int, text: str) -> None:
        if chat_id in self.fail_for:
            raise TelegramDeliveryError("Telegram API rejected the message: chat not found")
        self.sent.append((chat_id, text))


@pytest_asyncio.fixture
def fake_sender(monkeypatch) -> FakeTelegramSender:
    sender = FakeTelegramSender()
    monkeypatch.setattr(
        "app.application.emergency_service.get_telegram_sender",
        lambda: sender,
    )
    return sender


async def _create_contact(client: AsyncClient, **overrides) -> dict:
    payload = {
        "contact_name": "Мама",
        "contact_username": "mama",
        "notify_on_emergency": True,
    }
    payload.update(overrides)
    response = await client.post(f"{EMERGENCY}/contact", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _issue_code(client: AsyncClient, contact_id: int) -> str:
    response = await client.post(f"{EMERGENCY}/contact/{contact_id}/link-code")
    assert response.status_code == 200, response.text
    return response.json()["code"]


async def _link(db: AsyncSession, code: str, chat_id: int) -> None:
    """Simulate the contact sending ``/link <code>`` to the bot."""
    await EmergencyService(db).link_contact_by_code(code, chat_id)


async def test_notify_requires_authentication(client: AsyncClient) -> None:
    response = await client.post(f"{EMERGENCY}/notify", json={})
    assert response.status_code == 401


async def test_notify_without_contacts_is_rejected(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender
) -> None:
    response = await authenticated_client.post(f"{EMERGENCY}/notify", json={})
    assert response.status_code == 400
    assert fake_sender.sent == []


async def test_unlinked_contact_is_reported_as_undelivered(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender
) -> None:
    await _create_contact(authenticated_client)

    response = await authenticated_client.post(
        f"{EMERGENCY}/notify",
        json={"message": "Плохо", "location": "Зал"},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["successful_count"] == 0
    assert body["failed_count"] == 1
    result = body["results"][0]
    assert result["success"] is False
    assert result["method"] == "unlinked"
    assert "не подключён" in result["error"]
    assert fake_sender.sent == []

    contacts = (await authenticated_client.get(f"{EMERGENCY}/contact")).json()
    assert contacts["items"][0]["is_linked"] is False


async def test_linked_contact_receives_the_message(
    authenticated_client: AsyncClient,
    fake_sender: FakeTelegramSender,
    db_session: AsyncSession,
) -> None:
    contact = await _create_contact(authenticated_client)

    response = await authenticated_client.post(f"{EMERGENCY}/contact/{contact['id']}/link-code")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["command"] == f"/link {body['code']}"
    assert body["deep_link"] is None  # TELEGRAM_BOT_USERNAME is unset in tests

    chat_id = 555000111
    await _link(db_session, body["code"], chat_id)

    contacts = (await authenticated_client.get(f"{EMERGENCY}/contact")).json()
    assert contacts["items"][0]["is_linked"] is True

    notify = await authenticated_client.post(f"{EMERGENCY}/notify", json={"message": "Плохо"})
    assert notify.status_code == 200, notify.text
    payload = notify.json()
    assert payload["successful_count"] == 1
    assert payload["failed_count"] == 0
    assert payload["results"][0]["success"] is True
    assert [chat for chat, _ in fake_sender.sent] == [chat_id]
    assert "Плохо" in fake_sender.sent[0][1]


async def test_delivery_failure_from_bot_api_is_surfaced(
    authenticated_client: AsyncClient,
    fake_sender: FakeTelegramSender,
    db_session: AsyncSession,
) -> None:
    contact = await _create_contact(authenticated_client, contact_name="Отказ")
    code = await _issue_code(authenticated_client, contact["id"])

    failing_chat_id = 777000222
    fake_sender.fail_for = {failing_chat_id}
    await _link(db_session, code, failing_chat_id)

    response = await authenticated_client.post(f"{EMERGENCY}/notify", json={})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["successful_count"] == 0
    assert body["failed_count"] == 1
    assert "Ошибка доставки" in body["results"][0]["error"]


async def test_workout_start_notification_reports_real_counts(
    authenticated_client: AsyncClient,
    fake_sender: FakeTelegramSender,
    db_session: AsyncSession,
) -> None:
    linked = await _create_contact(
        authenticated_client,
        contact_name="Брат",
        contact_username="brat",
        notify_on_workout_start=True,
    )
    await _create_contact(
        authenticated_client,
        contact_name="Сестра",
        contact_username="sestra",
        notify_on_workout_start=True,
    )
    await _link(db_session, await _issue_code(authenticated_client, linked["id"]), 999888777)

    response = await authenticated_client.post(
        f"{EMERGENCY}/notify/workout-start",
        params={"workout_id": 1, "estimated_duration": 45},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["contacts_notified"] == 1
    assert body["contacts_failed"] == 1
    assert "1 из 2" in body["message"]
    assert "45 мин" in body["preview"]


async def test_unlink_clears_the_delivery_channel(
    authenticated_client: AsyncClient,
    fake_sender: FakeTelegramSender,
    db_session: AsyncSession,
) -> None:
    contact = await _create_contact(authenticated_client, contact_name="Друг")
    await _link(db_session, await _issue_code(authenticated_client, contact["id"]), 123123123)

    response = await authenticated_client.delete(f"{EMERGENCY}/contact/{contact['id']}/link")
    assert response.status_code == 200, response.text
    assert response.json()["is_linked"] is False

    notify = await authenticated_client.post(f"{EMERGENCY}/notify", json={})
    assert notify.json()["successful_count"] == 0


async def test_link_code_deep_link_uses_bot_username(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_BOT_USERNAME", "fittracker_pro_bot", raising=False)
    contact = await _create_contact(authenticated_client, contact_name="Тренер")

    response = await authenticated_client.post(f"{EMERGENCY}/contact/{contact['id']}/link-code")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deep_link"] == f"https://t.me/fittracker_pro_bot?start=link_{body['code']}"


async def test_new_invite_code_invalidates_the_previous_one(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender, db_session: AsyncSession
) -> None:
    """A leaked invite must not be able to hijack the delivery channel."""
    contact = await _create_contact(authenticated_client, contact_name="Перевыпуск")
    first = await _issue_code(authenticated_client, contact["id"])
    second = await _issue_code(authenticated_client, contact["id"])
    assert first != second

    with pytest.raises(EmergencyValidationError):
        await _link(db_session, first, 111222333)

    await _link(db_session, second, 111222333)
    contacts = (await authenticated_client.get(f"{EMERGENCY}/contact")).json()
    assert contacts["items"][0]["is_linked"] is True


async def test_unknown_link_code_is_rejected(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender, db_session: AsyncSession
) -> None:
    with pytest.raises(EmergencyValidationError):
        await _link(db_session, "nosuchcode", 424242)


async def test_owner_cannot_link_their_own_account(
    authenticated_client: AsyncClient, fake_sender: FakeTelegramSender, db_session: AsyncSession
) -> None:
    contact = await _create_contact(authenticated_client, contact_name="Я сам")
    code = await _issue_code(authenticated_client, contact["id"])

    owner = (await db_session.execute(select(User).limit(1))).scalars().first()
    assert owner is not None and owner.telegram_id is not None

    with pytest.raises(EmergencyValidationError):
        await _link(db_session, code, int(owner.telegram_id))
