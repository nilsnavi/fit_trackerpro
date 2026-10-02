from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from app.application.coach_entitlement_service import CoachEntitlementService
from app.domain.coach_client import CoachClient
from app.domain.coach_subscription import CoachSubscription
from app.domain.user import User
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _auth(client: AsyncClient, telegram_id: int) -> dict[str, str]:
    init = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user={"id": telegram_id, "first_name": "Coach"})
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _coach(client: AsyncClient, telegram_id: int) -> dict[str, str]:
    headers = await _auth(client, telegram_id)
    response = await client.post("/api/v1/coach/profile", headers=headers, json={"display_name": "Coach"})
    assert response.status_code == 201
    return headers


@pytest.mark.integration
async def test_new_coach_gets_single_trial_and_plan_catalog_has_no_price(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    headers = await _coach(client, 975001)
    result = await client.get("/api/v1/coach/subscription", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["plan"] == "TRAINER_PRO"
    assert result.json()["status"] == "TRIAL"
    assert result.json()["trial_days_remaining"] == 13 or result.json()["trial_days_remaining"] == 14
    plans = await client.get("/api/v1/coach/plans", headers=headers)
    assert plans.status_code == 200
    assert all("price" not in plan for plan in plans.json())
    assert {plan["plan"] for plan in plans.json()} == {"FREE", "TRAINER_PRO"}


@pytest.mark.integration
async def test_legacy_free_limits_and_feature_gate_return_business_codes(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    headers = await _coach(client, 975002)
    # Resolve the newly created coach by the test JWT subject mapping.
    from app.domain.user import User
    user = await db_session.scalar(select(User).where(User.telegram_id == 975002))
    row = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == user.id))
    row.plan, row.status = "FREE", "ACTIVE"
    await db_session.commit()
    for index in range(3):
        target = await _auth(client, 975010 + index)
        invite = await client.post("/api/v1/coach/invitations", headers=headers, json={})
        assert invite.status_code == 201, invite.text
        accepted = await client.post("/api/v1/coach/invitations/accept", headers=target, json={"token": invite.json()["token"]})
        assert accepted.status_code == 200, accepted.text
    invite = await client.post("/api/v1/coach/invitations", headers=headers, json={})
    assert invite.status_code == 403
    assert invite.json()["error"]["code"] == "CLIENT_LIMIT_REACHED"
    assert invite.json()["error"]["details"]["limit"] == 3
    paused_client = await client.patch(
        f"/api/v1/coach/clients/{accepted.json()['client_id']}",
        headers=headers,
        json={"status": "PAUSED"},
    )
    assert paused_client.status_code == 200, paused_client.text
    resumed_client = await client.patch(
        f"/api/v1/coach/clients/{accepted.json()['client_id']}",
        headers=headers,
        json={"status": "ACTIVE"},
    )
    assert resumed_client.status_code == 200, resumed_client.text
    for name in ("Program 1", "Program 2"):
        created = await client.post("/api/v1/coach/programs", headers=headers, json={"name": name})
        assert created.status_code == 201, created.text
    blocked_program = await client.post("/api/v1/coach/programs", headers=headers, json={"name": "Program 3"})
    assert blocked_program.status_code == 403
    assert blocked_program.json()["error"]["code"] == "PROGRAM_LIMIT_REACHED"
    assert blocked_program.json()["error"]["details"]["limit"] == 2
    advanced = await client.get("/api/v1/coach/monitoring?severity=ATTENTION", headers=headers)
    assert advanced.status_code == 403
    assert advanced.json()["error"]["code"] == "FEATURE_REQUIRES_TRAINER_PRO"


@pytest.mark.integration
async def test_expired_trial_uses_three_day_grace_then_downgrades(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    headers = await _coach(client, 975003)
    from app.domain.user import User
    user = await db_session.scalar(select(User).where(User.telegram_id == 975003))
    row = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == user.id))
    end = datetime.now(UTC) - timedelta(hours=1)
    row.trial_ends_at = end
    await db_session.commit()
    grace = await client.get("/api/v1/coach/subscription", headers=headers)
    assert grace.json()["status"] == "GRACE"
    assert grace.json()["plan"] == "TRAINER_PRO"
    row.grace_ends_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()
    free = await client.get("/api/v1/coach/subscription", headers=headers)
    assert free.json()["status"] == "ACTIVE"
    assert free.json()["plan"] == "FREE"


@pytest.mark.integration
async def test_denied_entitlement_persists_expired_grace_transition(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    headers = await _coach(client, 975032)
    user = await db_session.scalar(select(User).where(User.telegram_id == 975032))
    subscription = await db_session.scalar(
        select(CoachSubscription).where(CoachSubscription.coach_id == user.id)
    )
    subscription.status = "GRACE"
    subscription.grace_ends_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()

    denied = await client.get("/api/v1/coach/monitoring?severity=ATTENTION", headers=headers)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FEATURE_REQUIRES_TRAINER_PRO"
    await db_session.refresh(subscription)
    assert subscription.plan == "FREE"
    assert subscription.status == "ACTIVE"
    assert subscription.expired_at == subscription.grace_ends_at

    repeated = await client.get("/api/v1/coach/monitoring?severity=ATTENTION", headers=headers)
    assert repeated.status_code == 403
    await db_session.refresh(subscription)
    assert subscription.plan == "FREE"
    assert subscription.status == "ACTIVE"


@pytest.mark.integration
async def test_denied_capacity_persists_expired_grace_transition(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    headers = await _coach(client, 975033)
    coach = await db_session.scalar(select(User).where(User.telegram_id == 975033))
    subscription = await db_session.scalar(
        select(CoachSubscription).where(CoachSubscription.coach_id == coach.id)
    )
    clients = []
    for telegram_id in (975034, 975035, 975036):
        await _auth(client, telegram_id)
        clients.append(await db_session.scalar(select(User).where(User.telegram_id == telegram_id)))
    db_session.add_all(CoachClient(coach_id=coach.id, client_id=item.id) for item in clients)
    subscription.status = "GRACE"
    subscription.grace_ends_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()

    denied = await client.post("/api/v1/coach/invitations", headers=headers, json={})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "CLIENT_LIMIT_REACHED"
    await db_session.refresh(subscription)
    assert subscription.plan == "FREE"
    assert subscription.status == "ACTIVE"
    assert subscription.expired_at == subscription.grace_ends_at


@pytest.mark.integration
async def test_concurrent_invitation_accepts_cannot_exceed_free_client_limit(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _coach(client, 975004)
    from app.domain.user import User
    coach_user = await db_session.scalar(select(User).where(User.telegram_id == 975004))
    subscription = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == coach_user.id))
    subscription.plan, subscription.status = "FREE", "ACTIVE"
    await db_session.commit()

    async def new_client(telegram_id: int) -> dict[str, str]:
        return await _auth(client, telegram_id)

    # Consume two of three slots first; only one of the following concurrent accepts fits.
    for telegram_id in (975040, 975043):
        existing_client = await new_client(telegram_id)
        invitation = await client.post("/api/v1/coach/invitations", headers=coach, json={})
        assert invitation.status_code == 201
        accepted = await client.post("/api/v1/coach/invitations/accept", headers=existing_client, json={"token": invitation.json()["token"]})
        assert accepted.status_code == 200, accepted.text
    invites = []
    clients = []
    for index in range(2):
        invitation = await client.post("/api/v1/coach/invitations", headers=coach, json={})
        assert invitation.status_code == 201
        invites.append(invitation.json()["token"])
        clients.append(await new_client(975041 + index))
    responses = await asyncio.gather(*(
        client.post("/api/v1/coach/invitations/accept", headers=headers, json={"token": token})
        for headers, token in zip(clients, invites, strict=True)
    ))
    assert sorted(response.status_code for response in responses) == [200, 403]
    denied = next(response for response in responses if response.status_code == 403)
    assert denied.json()["error"]["code"] == "CLIENT_LIMIT_REACHED"


@pytest.mark.integration
async def test_trial_boundary_is_inclusive_and_pro_trial_bypasses_free_limits(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _coach(client, 975005)
    from app.domain.user import User
    user = await db_session.scalar(select(User).where(User.telegram_id == 975005))
    row = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == user.id))
    boundary = datetime.now(UTC)
    row.trial_ends_at = boundary
    await db_session.commit()
    service = CoachEntitlementService(db_session)
    row = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == user.id))
    await service._advance(row, boundary)
    assert row.status == "GRACE"
    row.status, row.plan = "TRIAL", "TRAINER_PRO"
    row.trial_ends_at = datetime.now(UTC) + timedelta(days=10)
    await db_session.commit()

    for index in range(4):
        client_headers = await _auth(client, 975050 + index)
        invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
        assert invite.status_code == 201, invite.text
        accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": invite.json()["token"]})
        assert accepted.status_code == 200, accepted.text
    for index in range(3):
        program = await client.post("/api/v1/coach/programs", headers=coach, json={"name": f"Trial program {index}"})
        assert program.status_code == 201, program.text


@pytest.mark.integration
async def test_downgrade_preserves_over_limit_data_and_archives_release_slots(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _coach(client, 975006)
    from app.domain.user import User
    user = await db_session.scalar(select(User).where(User.telegram_id == 975006))
    row = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == user.id))

    for index in range(4):
        client_headers = await _auth(client, 975060 + index)
        invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
        accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": invite.json()["token"]})
        assert accepted.status_code == 200
    for index in range(3):
        assert (await client.post("/api/v1/coach/programs", headers=coach, json={"name": f"Preserved {index}"})).status_code == 201

    row.plan, row.status = "FREE", "ACTIVE"
    await db_session.commit()
    clients = await client.get("/api/v1/coach/clients", headers=coach)
    programs = await client.get("/api/v1/coach/programs", headers=coach)
    assert len(clients.json()) == 4
    assert len(programs.json()) == 3
    paused = await client.patch(f"/api/v1/coach/clients/{clients.json()[0]['client_id']}", headers=coach, json={"status": "PAUSED"})
    assert paused.status_code == 200
    assert (await client.post("/api/v1/coach/invitations", headers=coach, json={})).json()["error"]["code"] == "CLIENT_LIMIT_REACHED"
    assert (await client.post("/api/v1/coach/programs", headers=coach, json={"name": "Blocked"})).json()["error"]["code"] == "PROGRAM_LIMIT_REACHED"

    for archived_client in clients.json()[1:3]:
        archived_response = await client.patch(f"/api/v1/coach/clients/{archived_client['client_id']}", headers=coach, json={"status": "ARCHIVED"})
        assert archived_response.status_code == 200
    allowed_invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
    assert allowed_invite.status_code == 201
    archived = await client.delete(f"/api/v1/coach/programs/{programs.json()[0]['id']}", headers=coach)
    assert archived.status_code == 200
    still_at_limit = await client.post("/api/v1/coach/programs", headers=coach, json={"name": "Still full"})
    assert still_at_limit.status_code == 403
    archived_second = await client.delete(f"/api/v1/coach/programs/{programs.json()[1]['id']}", headers=coach)
    assert archived_second.status_code == 200
    allowed_program = await client.post("/api/v1/coach/programs", headers=coach, json={"name": "Released slot"})
    assert allowed_program.status_code == 201, allowed_program.text


@pytest.mark.integration
async def test_subscription_is_coach_only_and_cannot_be_mutated_over_http(client: AsyncClient, db_session):
    from sqlalchemy import text
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _coach(client, 975007)
    regular_user = await _auth(client, 975070)
    denied = await client.get("/api/v1/coach/subscription", headers=regular_user)
    assert denied.status_code == 403
    mutation = await client.patch("/api/v1/coach/subscription", headers=coach, json={"plan": "TRAINER_PRO"})
    assert mutation.status_code == 405


@pytest.mark.integration
async def test_subscription_unique_fk_and_trial_cannot_be_restarted(client: AsyncClient, db_session):
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _coach(client, 975008)
    from app.domain.user import User
    user = await db_session.scalar(select(User).where(User.telegram_id == 975008))
    coach_id = user.id
    original = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == coach_id))
    original_trial_end = original.trial_ends_at
    duplicate = CoachSubscription(coach_id=coach_id, plan="TRAINER_PRO", status="TRIAL")
    db_session.add(duplicate)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

    repeat = await client.post("/api/v1/coach/profile", headers=coach, json={"display_name": "Again"})
    assert repeat.status_code == 409
    persisted = await db_session.scalar(select(CoachSubscription).where(CoachSubscription.coach_id == coach_id))
    assert persisted.trial_ends_at == original_trial_end
