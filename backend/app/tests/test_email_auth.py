from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.application import email_auth_service
from app.domain.email_challenge import EmailChallenge

ROOT = "/api/v1/users/auth"


@pytest.fixture
def outbox(monkeypatch):
    messages = {}

    async def deliver(recipient, code):
        messages[recipient] = code

    monkeypatch.setattr(email_auth_service.settings, "AUTH_SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(email_auth_service.settings, "AUTH_SMTP_FROM", "login@example.test")
    monkeypatch.setattr(email_auth_service, "deliver_email_code", deliver)
    return messages


def bearer(session):
    return {"Authorization": f"Bearer {session['access_token']}"}


async def send(client, email, outbox, headers=None):
    path = "/email/link/request" if headers else "/email/request"
    response = await client.post(ROOT + path, json={"email": email}, headers=headers)
    assert response.status_code == 200, response.text
    assert "code" not in response.json()
    return {**response.json(), "code": outbox[email.casefold()]}


async def test_email_registration_login_refresh_and_replay(client, outbox, db_session):
    code = await send(client, "Athlete@example.com", outbox)
    response = await client.post(ROOT + "/email/verify", json=code)
    assert response.status_code == 200, response.text
    session = response.json()
    profile = await client.get(ROOT + "/me", headers=bearer(session))
    assert profile.json()["email"] == "athlete@example.com"
    assert profile.json()["telegram_id"] is None
    assert (await client.post(ROOT + "/email/verify", json=code)).status_code == 400
    assert (await client.post(ROOT + "/email/request", json={"email": "athlete@example.com"})).status_code == 429

    refresh = await client.post(ROOT + "/refresh", json={"refresh_token": session["refresh_token"]})
    assert refresh.status_code == 200, refresh.text
    assert (await client.get(ROOT + "/me", headers=bearer(refresh.json()))).json()["id"] == profile.json()["id"]

    await db_session.execute(update(EmailChallenge).values(sent_at=datetime.now(timezone.utc) - timedelta(minutes=2)))
    await db_session.commit()
    next_code = await send(client, "athlete@example.com", outbox)
    login = await client.post(ROOT + "/email/verify", json=next_code)
    assert login.status_code == 200
    assert (await client.get(ROOT + "/me", headers=bearer(login.json()))).json()["id"] == profile.json()["id"]


async def test_link_keeps_existing_account_and_code_is_bound_to_session(client, outbox, mock_telegram_auth_body, db_session):
    response = await client.post(ROOT + "/telegram", json=mock_telegram_auth_body)
    headers = bearer(response.json())
    original = (await client.get(ROOT + "/me", headers=headers)).json()
    code = await send(client, "existing@example.com", outbox, headers)
    assert (await client.post(ROOT + "/email/verify", json=code)).status_code == 400
    assert (await client.post(ROOT + "/email/link/verify", json=code)).status_code == 401
    assert (await client.post(ROOT + "/email/link/verify", json=code, headers=headers)).status_code == 204

    await db_session.execute(update(EmailChallenge).values(sent_at=datetime.now(timezone.utc) - timedelta(minutes=2)))
    await db_session.commit()
    login = await client.post(ROOT + "/email/verify", json=await send(client, "existing@example.com", outbox))
    profile = (await client.get(ROOT + "/me", headers=bearer(login.json()))).json()
    assert profile["id"] == original["id"]
    assert profile["telegram_id"] == original["telegram_id"]


async def test_attempt_limit_and_expiry(client, outbox, db_session):
    code = await send(client, "attempts@example.com", outbox)
    wrong = {**code, "code": "000000" if code["code"] != "000000" else "000001"}
    for _ in range(5):
        assert (await client.post(ROOT + "/email/verify", json=wrong)).status_code == 400
    assert (await client.post(ROOT + "/email/verify", json=code)).status_code == 400

    code = await send(client, "expired@example.com", outbox)
    await db_session.execute(update(EmailChallenge).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    await db_session.commit()
    assert (await client.post(ROOT + "/email/verify", json=code)).status_code == 400


async def test_existing_address_cannot_be_claimed_by_another_account(
    client, outbox, mock_telegram_auth_body, db_session,
):
    code = await send(client, "owner@example.com", outbox)
    assert (await client.post(ROOT + "/email/verify", json=code)).status_code == 200
    await db_session.execute(update(EmailChallenge).values(sent_at=datetime.now(timezone.utc) - timedelta(minutes=2)))
    await db_session.commit()

    login = await client.post(ROOT + "/telegram", json=mock_telegram_auth_body)
    headers = bearer(login.json())
    link = await send(client, "owner@example.com", outbox, headers)
    assert (await client.post(ROOT + "/email/link/verify", json=link, headers=headers)).status_code == 409
    assert (await client.get(ROOT + "/me", headers=headers)).json()["email"] is None
