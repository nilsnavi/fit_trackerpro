from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.settings import settings
from app.tests.telegram_webapp import build_init_data

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


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


async def _connected_pair(client: AsyncClient, coach_headers: dict[str, str], client_headers: dict[str, str]) -> int:
    invitation = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    assert invitation.status_code == 201, invitation.text
    accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": invitation.json()["token"]})
    assert accepted.status_code == 200, accepted.text
    return accepted.json()["client_id"]


async def _enable_coach(db_session) -> None:
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()


async def _make_package(client: AsyncClient, coach_headers: dict[str, str], name: str, sessions: int = 5) -> int:
    response = await client.post("/api/v1/coach/packages", headers=coach_headers, json={
        "name": name, "sessions_total": sessions, "validity_days": 30, "price_amount": "5000.00",
    })
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _assign_package(client: AsyncClient, coach_headers: dict[str, str], client_id: int, package_id: int) -> dict:
    response = await client.post(f"/api/v1/coach/clients/{client_id}/packages", headers=coach_headers, json={
        "package_id": package_id,
    })
    assert response.status_code == 201, response.text
    return response.json()


async def test_package_template_lifecycle(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964001, "Coach A")
    package_id = await _make_package(client, coach_headers, "Personal 5", sessions=5)

    listed = await client.get("/api/v1/coach/packages", headers=coach_headers)
    assert listed.status_code == 200 and [item["id"] for item in listed.json()] == [package_id]

    updated = await client.patch(f"/api/v1/coach/packages/{package_id}", headers=coach_headers, json={"price_amount": "6000.00"})
    assert updated.status_code == 200 and Decimal(updated.json()["price_amount"]) == Decimal("6000.00")

    archived = await client.delete(f"/api/v1/coach/packages/{package_id}", headers=coach_headers)
    assert archived.status_code == 200 and archived.json()["status"] == "ARCHIVED"

    active_only = await client.get("/api/v1/coach/packages", headers=coach_headers)
    assert active_only.json() == []
    with_archived = await client.get("/api/v1/coach/packages?include_archived=true", headers=coach_headers)
    assert [item["id"] for item in with_archived.json()] == [package_id]


async def test_consume_reverse_and_ledger_invariants(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964101, "Coach B")
    client_headers = await _headers(client, 964102, "Client B")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    package_id = await _make_package(client, coach_headers, "Group 10", sessions=3)
    client_package = await _assign_package(client, coach_headers, client_id, package_id)
    cp_id = client_package["id"]
    assert client_package["sessions_remaining"] == 3
    assert client_package["expires_at"] is not None

    consume = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/consume", headers=coach_headers, json={})
    assert consume.status_code == 200, consume.text
    assert consume.json()["sessions_used"] == 1

    duplicate = await client.post(
        f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/consume",
        headers={**coach_headers, "Idempotency-Key": "op-1"},
        json={},
    )
    assert duplicate.status_code == 200
    replay = await client.post(
        f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/consume",
        headers={**coach_headers, "Idempotency-Key": "op-1"},
        json={},
    )
    assert replay.status_code == 409

    reversed_response = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/reverse", headers=coach_headers, json={"note": "mistake"})
    assert reversed_response.status_code == 200, reversed_response.text
    assert reversed_response.json()["sessions_used"] == 1

    detail = await client.get(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}", headers=coach_headers)
    assert detail.status_code == 200, detail.text
    ledger = detail.json()["usage"]
    assert len(ledger) == 3  # consume, consume, reverse
    assert sum(item["delta"] for item in ledger) == -1

    # The second consume is still open, so one more reversal is legitimate…
    second_reverse = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/reverse", headers=coach_headers, json={})
    assert second_reverse.status_code == 200 and second_reverse.json()["sessions_used"] == 0
    # …but with nothing left to reverse the call must conflict.
    overdrawn = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/reverse", headers=coach_headers, json={})
    assert overdrawn.status_code == 409


async def test_consume_beyond_total_is_blocked(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964201, "Coach C")
    client_headers = await _headers(client, 964202, "Client C")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    package_id = await _make_package(client, coach_headers, "Single", sessions=1)
    cp = await _assign_package(client, coach_headers, client_id, package_id)

    first = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp['id']}/consume", headers=coach_headers, json={})
    assert first.status_code == 200 and first.json()["status"] == "EXHAUSTED"
    second = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp['id']}/consume", headers=coach_headers, json={})
    assert second.status_code == 409


async def test_auto_consume_is_idempotent_by_workout(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964301, "Coach D")
    client_headers = await _headers(client, 964302, "Client D")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    package_id = await _make_package(client, coach_headers, "Auto pack", sessions=5)

    response = await client.post(f"/api/v1/coach/clients/{client_id}/packages", headers=coach_headers, json={
        "package_id": package_id, "auto_consume": True,
    })
    assert response.status_code == 201, response.text
    cp_id = response.json()["id"]

    profile = await client.get("/api/v1/coach/profile", headers=coach_headers)
    assert profile.status_code == 200, profile.text
    coach_db_id = profile.json()["user_id"]

    from app.application.coach_business_service import CoachBusinessService
    service = CoachBusinessService(db_session)
    first = await service.auto_consume_completed_workout(coach_id=coach_db_id, client_id=client_id, workout_id=999001)
    assert first is not None and first.sessions_used == 1
    again = await service.auto_consume_completed_workout(coach_id=coach_db_id, client_id=client_id, workout_id=999001)
    assert again is not None and again.sessions_used == 1  # replay does not double-consume
    manual = await client.post(
        f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/consume",
        headers=coach_headers, json={"workout_id": 999001},
    )
    assert manual.status_code == 409  # same workout cannot be consumed twice


async def test_payments_record_and_reverse_keep_history(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964401, "Coach E")
    client_headers = await _headers(client, 964402, "Client E")
    client_id = await _connected_pair(client, coach_headers, client_headers)

    recorded = await client.post(f"/api/v1/coach/clients/{client_id}/payments", headers=coach_headers, json={
        "amount": "7500.00", "method": "CARD", "comment": "First month",
    })
    assert recorded.status_code == 201, recorded.text
    payment_id = recorded.json()["id"]
    assert recorded.json()["status"] == "RECORDED"

    reversed_payment = await client.post(
        f"/api/v1/coach/clients/{client_id}/payments/{payment_id}/reverse", headers=coach_headers
    )
    assert reversed_payment.status_code == 200 and reversed_payment.json()["status"] == "REVERSED"
    double_reverse = await client.post(
        f"/api/v1/coach/clients/{client_id}/payments/{payment_id}/reverse", headers=coach_headers
    )
    assert double_reverse.status_code == 409

    history = await client.get(f"/api/v1/coach/clients/{client_id}/payments", headers=coach_headers)
    assert history.status_code == 200 and len(history.json()) == 1  # original row retained


async def test_tasks_crud_and_filters(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964501, "Coach F")
    client_headers = await _headers(client, 964502, "Client F")
    client_id = await _connected_pair(client, coach_headers, client_headers)

    created = await client.post("/api/v1/coach/tasks", headers=coach_headers, json={
        "client_id": client_id, "title": "Отправить план", "priority": "HIGH",
    })
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    todo = await client.get("/api/v1/coach/tasks", headers=coach_headers)
    assert todo.status_code == 200 and [item["id"] for item in todo.json()] == [task_id]

    done = await client.post(f"/api/v1/coach/tasks/{task_id}/complete", headers=coach_headers)
    assert done.status_code == 200 and done.json()["completed_at"] is not None
    pending = await client.get("/api/v1/coach/tasks?completed=false", headers=coach_headers)
    assert pending.json() == []
    completed_list = await client.get("/api/v1/coach/tasks?completed=true", headers=coach_headers)
    assert [item["id"] for item in completed_list.json()] == [task_id]

    deleted = await client.delete(f"/api/v1/coach/tasks/{task_id}", headers=coach_headers)
    assert deleted.status_code == 204
    missing = await client.get("/api/v1/coach/tasks", headers=coach_headers)
    assert missing.json() == []


async def test_object_authorization_is_scoped_to_coach(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964601, "Coach G")
    other_headers = await _coach(client, 964602, "Coach H")
    client_headers = await _headers(client, 964603, "Client G")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    package_id = await _make_package(client, coach_headers, "Scoped", sessions=5)
    cp = await _assign_package(client, coach_headers, client_id, package_id)

    foreign_package = await client.get(f"/api/v1/coach/clients/{client_id}/packages/{cp['id']}", headers=other_headers)
    assert foreign_package.status_code == 404
    foreign_consume = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp['id']}/consume", headers=other_headers, json={})
    assert foreign_consume.status_code == 404
    foreign_task = await client.patch("/api/v1/coach/tasks/1", headers=other_headers, json={"title": "nope"})
    assert foreign_task.status_code == 404

    client_consume = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp['id']}/consume", headers=client_headers, json={})
    assert client_consume.status_code == 403


async def test_expired_package_blocks_consumption(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964701, "Coach I")
    client_headers = await _headers(client, 964702, "Client I")
    client_id = await _connected_pair(client, coach_headers, client_headers)

    response = await client.post(f"/api/v1/coach/clients/{client_id}/packages", headers=coach_headers, json={
        "name": "Expired pack", "sessions_total": 5, "expires_at": (date.today() - timedelta(days=1)).isoformat(),
    })
    assert response.status_code == 201, response.text
    cp_id = response.json()["id"]
    consume = await client.post(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}/consume", headers=coach_headers, json={})
    assert consume.status_code == 409


async def test_assigned_workout_completion_auto_consumes_once(client: AsyncClient, db_session):
    await _enable_coach(db_session)
    coach_headers = await _coach(client, 964801, "Coach J")
    client_headers = await _headers(client, 964802, "Client J")
    client_id = await _connected_pair(client, coach_headers, client_headers)

    template = await client.post("/api/v1/workouts/templates", headers=coach_headers, json={
        "name": "Auto template", "type": "strength", "is_public": False,
        "exercises": [{"exercise_id": 1, "name": "Push-up", "sets": 3, "reps": 10, "rest_seconds": 60}],
    })
    assert template.status_code == 201, template.text
    program = await client.post("/api/v1/coach/programs", headers=coach_headers, json={
        "name": "Auto program", "days": [{"day_number": 1, "name": "Day 1", "workout_template_id": template.json()["id"]}],
    })
    assert program.status_code == 201, program.text
    program_id = program.json()["id"]
    day_id = program.json()["days"][0]["id"]
    assert (await client.post(f"/api/v1/coach/programs/{program_id}/activate", headers=coach_headers)).status_code == 200
    assignment = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach_headers, json={"client_id": client_id})
    assert assignment.status_code == 201, assignment.text

    package_id = await _make_package(client, coach_headers, "Auto pack", sessions=5)
    assigned_package = await client.post(f"/api/v1/coach/clients/{client_id}/packages", headers=coach_headers, json={
        "package_id": package_id, "auto_consume": True,
    })
    assert assigned_package.status_code == 201, assigned_package.text
    cp_id = assigned_package.json()["id"]

    key = f"auto-consume-start-{client_id}"
    started = await client.post(
        f"/api/v1/client/coach-programs/{assignment.json()['id']}/days/{day_id}/start",
        headers={**client_headers, "Idempotency-Key": key},
    )
    assert started.status_code == 200, started.text
    session_id = started.json()["workout_session_id"]

    completed = await client.post("/api/v1/workouts/complete", headers=client_headers, params={"workout_id": session_id}, json={
        "duration": 30,
        "exercises": [{"exercise_id": 1, "name": "Push-up", "sets_completed": [{"set_number": 1, "reps": 10, "weight": 0}]}],
        "idempotency_key": f"complete-{session_id}",
    })
    assert completed.status_code == 200, completed.text

    detail = await client.get(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}", headers=coach_headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["sessions_used"] == 1
    reasons = [item["reason"] for item in detail.json()["usage"]]
    assert reasons == ["AUTO_CONSUME"]

    replay = await client.post("/api/v1/workouts/complete", headers=client_headers, params={"workout_id": session_id}, json={
        "duration": 30,
        "exercises": [{"exercise_id": 1, "name": "Push-up", "sets_completed": [{"set_number": 1, "reps": 10, "weight": 0}]}],
        "idempotency_key": f"complete-2-{session_id}",
    })
    assert replay.status_code == 200, replay.text
    detail_after = await client.get(f"/api/v1/coach/clients/{client_id}/packages/{cp_id}", headers=coach_headers)
    assert detail_after.json()["sessions_used"] == 1
