"""Client consent API: account ownership, opt-in and durable audit."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from app.domain.coach_client_grant import CoachClientGrant
from app.domain.coach_grant_audit import CoachGrantAudit
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _headers(client: AsyncClient, telegram_id: int) -> dict[str, str]:
    init_data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": telegram_id, "first_name": "Consent Test"},
    )
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.integration
async def test_grant_owner_revoke_idempotency_and_audit(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _headers(client, 978001)
    athlete = await _headers(client, 978002)
    other = await _headers(client, 978003)

    created = await client.post("/api/v1/coach/profile", json={"display_name": "Coach Consent"}, headers=coach)
    assert created.status_code == 201, created.text
    coach_id = created.json()["user_id"]
    invite = await client.post("/api/v1/coach/invitations", json={}, headers=coach)
    assert invite.status_code == 201, invite.text
    token = invite.json()["token"]
    accepted = await client.post("/api/v1/coach/invitations/accept", json={"token": token}, headers=athlete)
    assert accepted.status_code == 200, accepted.text

    uri = "/api/v1/client/coach-grants"
    body = {"coach_id": coach_id, "scope": "training_summary.read", "consent_version": "v2-03c-1"}
    unauthorized = await client.post(uri, json=body)
    assert unauthorized.status_code == 401
    no_permission = await client.post(uri, json=body, headers=other)
    assert no_permission.status_code == 404
    health = await client.post(uri, headers=athlete, json={**body, "scope": "health_metrics.read"})
    assert health.status_code == 422

    grant = await client.post(uri, json=body, headers=athlete)
    assert grant.status_code == 201, grant.text
    grant_id = grant.json()["id"]
    assert grant.json()["status"] == "ACTIVE"
    second = await client.post(uri, json=body, headers=athlete)
    assert second.status_code == 201, second.text
    assert second.json()["id"] == grant_id

    own = await client.get(uri, headers=athlete)
    assert own.status_code == 200
    assert len(own.json()) == 1
    assert own.json()[0]["id"] == grant_id
    assert (await client.get(uri, headers=other)).json() == []
    assert (await client.get(uri, headers=coach)).json() == []

    wrong_delete = await client.delete(f"{uri}/{grant_id}", headers=other)
    assert wrong_delete.status_code == 404
    revoked = await client.delete(f"{uri}/{grant_id}", headers=athlete)
    assert revoked.status_code == 204
    repeated = await client.delete(f"{uri}/{grant_id}", headers=athlete)
    assert repeated.status_code == 204
    assert (await client.get(uri, headers=athlete)).json()[0]["status"] == "REVOKED"

    records = list((await db_session.scalars(select(CoachGrantAudit).order_by(CoachGrantAudit.occurred_at))).all())
    assert [item.action for item in records] == ["GRANTED", "REVOKED"]
    assert all(item.client_id == item.actor_id for item in records)
    assert all(item.grant_id == grant_id for item in records)
    assert all(item.scope == "training_summary.read" for item in records)
    assert (await db_session.scalar(select(CoachClientGrant).where(CoachClientGrant.id == grant_id))).status == "REVOKED"

    reissued = await client.post(uri, json=body, headers=athlete)
    assert reissued.status_code == 201, reissued.text
    assert reissued.json()["id"] == grant_id
    records = list((await db_session.scalars(select(CoachGrantAudit))).all())
    assert sorted(item.action for item in records) == ["GRANTED", "GRANTED", "REVOKED"]


@pytest.mark.integration
async def test_grant_rejects_missing_relationship_and_invalid_identifiers(client: AsyncClient):
    person = await _headers(client, 979001)
    uri = "/api/v1/client/coach-grants"
    result = await client.post(uri, headers=person, json={
        "coach_id": 999999, "scope": "workout_history.read", "consent_version": "v2-03c-1"
    })
    assert result.status_code == 404
    res = await client.delete(uri + "/not-a-uuid", headers=person)
    assert res.status_code in (404, 422)


@pytest.mark.integration
async def test_available_coaches_are_active_scoped_and_safe(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _headers(client, 979101)
    athlete = await _headers(client, 979102)
    stranger = await _headers(client, 979103)

    profile = await client.post(
        "/api/v1/coach/profile", headers=coach, json={"display_name": "Trainer Alex"},
    )
    assert profile.status_code == 201, profile.text
    invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
    assert invite.status_code == 201, invite.text
    accepted = await client.post(
        "/api/v1/coach/invitations/accept", headers=athlete,
        json={"token": invite.json()["token"]},
    )
    assert accepted.status_code == 200, accepted.text

    url = "/api/v1/client/coach-grants/available-coaches"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=stranger)).json() == []
    response = await client.get(url, headers=athlete)
    assert response.status_code == 200, response.text
    assert response.json() == [
        {"coach_id": profile.json()["user_id"], "display_name": "Trainer Alex"}
    ]
    assert "telegram_id" not in response.text
    assert "email" not in response.text

    paused = await client.patch(
        f"/api/v1/coach/clients/{accepted.json()['client_id']}",
        headers=coach, json={"status": "PAUSED"},
    )
    assert paused.status_code == 200, paused.text
    response = await client.get(url, headers=athlete)
    assert response.status_code == 200 and response.json() == []

    rejected = await client.post(
        "/api/v1/client/coach-grants", headers=athlete,
        json={
            "coach_id": profile.json()["user_id"],
            "scope": "training_summary.read",
            "consent_version": "v2-03c-1",
        },
    )
    assert rejected.status_code == 404
