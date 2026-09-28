from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from app.application.coach_service import invitation_token_hash
from app.core.audit import (
    COACH_INVITATION_ACCEPT,
    COACH_INVITATION_CREATE,
    COACH_INVITATION_REVOKE,
    COACH_PROFILE_CREATE,
    COACH_PROFILE_UPDATE,
    COACH_RELATIONSHIP_CREATE,
    COACH_RELATIONSHIP_STATUS_CHANGE,
)
from app.domain.coach_client import CoachClient
from app.domain.coach_invitation import CoachInvitation
from app.domain.user_role import UserRole
from app.schemas.coach import DEFAULT_COACH_CLIENT_PERMISSIONS
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _auth_headers(client: AsyncClient, telegram_id: int, name: str) -> dict[str, str]:
    init_data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": telegram_id, "first_name": name, "username": f"user{telegram_id}"},
    )
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _enable_coach(db_session) -> None:
    await db_session.execute(
        text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)")
    )
    await db_session.commit()


async def _create_profile(client: AsyncClient, headers: dict[str, str], name: str):
    response = await client.post(
        "/api/v1/coach/profile",
        headers=headers,
        json={"display_name": name, "specializations": ["strength"], "timezone": "UTC"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.integration
async def test_coach_invitation_lifecycle_hashing_and_default_permissions(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _auth_headers(client, 910001, "Coach")
    client_headers = await _auth_headers(client, 910002, "Client")

    profile = await _create_profile(client, coach_headers, "Coach One")
    duplicate = await client.post(
        "/api/v1/coach/profile", headers=coach_headers, json={"display_name": "Duplicate"}
    )
    assert duplicate.status_code == 409

    role = await db_session.scalar(select(UserRole).where(UserRole.user_id == profile["user_id"]))
    assert role is not None and role.role == "COACH"

    created = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    assert created.status_code == 201, created.text
    invitation = created.json()
    token = invitation.pop("token")
    assert len(token) >= 40

    stored = await db_session.scalar(select(CoachInvitation).where(CoachInvitation.id == invitation["id"]))
    assert stored is not None
    assert stored.token_hash == invitation_token_hash(token)
    assert token not in repr(stored)
    assert len(stored.token_hash) == 64
    assert stored.expires_at - stored.created_at <= timedelta(days=7, seconds=5)

    resolved = await client.get("/api/v1/coach/invitations/resolve", headers=client_headers, params={"token": token})
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["coach"]["display_name"] == "Coach One"
    assert resolved.json()["permissions"] == DEFAULT_COACH_CLIENT_PERMISSIONS.model_dump()

    accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": token})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["permissions"] == DEFAULT_COACH_CLIENT_PERMISSIONS.model_dump()

    reused = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": token})
    assert reused.status_code == 409

    clients = await client.get("/api/v1/coach/clients", headers=coach_headers)
    assert clients.status_code == 200
    assert len(clients.json()) == 1
    assert clients.json()[0]["permissions"] == {}


@pytest.mark.integration
async def test_coach_flag_idor_and_archived_relationship_controls(client: AsyncClient, db_session):
    coach_a_headers = await _auth_headers(client, 920001, "Coach A")
    disabled = await client.post("/api/v1/coach/profile", headers=coach_a_headers, json={"display_name": "Blocked"})
    assert disabled.status_code == 404

    await _enable_coach(db_session)
    coach_b_headers = await _auth_headers(client, 920002, "Coach B")
    client_headers = await _auth_headers(client, 920003, "Client")
    coach_a = await _create_profile(client, coach_a_headers, "Coach A")
    await _create_profile(client, coach_b_headers, "Coach B")

    invite = await client.post("/api/v1/coach/invitations", headers=coach_a_headers, json={})
    token = invite.json()["token"]
    accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": token})
    assert accepted.status_code == 200
    client_id = accepted.json()["client_id"]

    foreign = await client.get(f"/api/v1/coach/clients/{client_id}", headers=coach_b_headers)
    assert foreign.status_code == 404
    not_coach = await client.get("/api/v1/coach/clients", headers=client_headers)
    assert not_coach.status_code == 403

    archived = await client.patch(
        f"/api/v1/coach/clients/{client_id}", headers=coach_a_headers, json={"status": "ARCHIVED"}
    )
    assert archived.status_code == 200, archived.text
    blocked = await client.get(f"/api/v1/coach/clients/{client_id}", headers=coach_a_headers)
    assert blocked.status_code == 404

    relationship = await db_session.scalar(
        select(CoachClient).where(CoachClient.coach_id == coach_a["user_id"], CoachClient.client_id == client_id)
    )
    assert relationship is not None and relationship.archived_at is not None


@pytest.mark.integration
async def test_coach_invitation_expired_revoked_and_self_invite(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _auth_headers(client, 930001, "Coach")
    client_headers = await _auth_headers(client, 930002, "Client")
    await _create_profile(client, coach_headers, "Coach")

    self_invitation = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    self_accept = await client.post(
        "/api/v1/coach/invitations/accept", headers=coach_headers, json={"token": self_invitation.json()["token"]}
    )
    assert self_accept.status_code == 409

    expired = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    expired_id, expired_token = expired.json()["id"], expired.json()["token"]
    invitation = await db_session.get(CoachInvitation, expired_id)
    invitation.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()
    expired_response = await client.get("/api/v1/coach/invitations/resolve", headers=client_headers, params={"token": expired_token})
    assert expired_response.status_code == 410
    await db_session.refresh(invitation)
    assert invitation.status == "EXPIRED"

    revoked = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    revoked_id, revoked_token = revoked.json()["id"], revoked.json()["token"]
    revoke_response = await client.delete(f"/api/v1/coach/invitations/{revoked_id}", headers=coach_headers)
    assert revoke_response.status_code == 204
    revoked_response = await client.get("/api/v1/coach/invitations/resolve", headers=client_headers, params={"token": revoked_token})
    assert revoked_response.status_code == 410


@pytest.mark.integration
async def test_coach_profile_security_and_terminal_relationship_status(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _auth_headers(client, 940001, "Coach")
    other_headers = await _auth_headers(client, 940002, "Other")
    created = await client.post(
        "/api/v1/coach/profile", headers=coach_headers,
        json={"display_name": "Coach"},
    )
    assert created.status_code == 201
    assert created.json()["user_id"] != 940002
    body_user_id = await client.post(
        "/api/v1/coach/profile", headers=other_headers,
        json={"display_name": "Other", "user_id": created.json()["user_id"]},
    )
    assert body_user_id.status_code == 422
    denied_update = await client.patch(
        "/api/v1/coach/profile", headers=coach_headers, json={"is_active": False}
    )
    assert denied_update.status_code == 422

    invitation = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    token = invitation.json()["token"]
    foreign_revoke = await client.delete(
        f"/api/v1/coach/invitations/{invitation.json()['id']}", headers=other_headers
    )
    assert foreign_revoke.status_code == 403

    client_headers = await _auth_headers(client, 940003, "Client")
    accepted = await client.post(
        "/api/v1/coach/invitations/accept", headers=client_headers, json={"token": token}
    )
    client_id = accepted.json()["client_id"]
    revoked = await client.patch(
        f"/api/v1/coach/clients/{client_id}", headers=coach_headers,
        json={"status": "REVOKED"},
    )
    assert revoked.status_code == 200
    restore = await client.patch(
        f"/api/v1/coach/clients/{client_id}", headers=coach_headers,
        json={"status": "ACTIVE"},
    )
    assert restore.status_code == 404


def test_coach_audit_action_contract():
    assert {
        COACH_PROFILE_CREATE,
        COACH_PROFILE_UPDATE,
        COACH_INVITATION_CREATE,
        COACH_INVITATION_REVOKE,
        COACH_INVITATION_ACCEPT,
        COACH_RELATIONSHIP_CREATE,
        COACH_RELATIONSHIP_STATUS_CHANGE,
    } == {
        "coach.profile.created",
        "coach.profile.updated",
        "coach.invitation.created",
        "coach.invitation.revoked",
        "coach.invitation.accepted",
        "coach.relationship.created",
        "coach.relationship.status_changed",
    }
