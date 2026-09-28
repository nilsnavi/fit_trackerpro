from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _headers(client: AsyncClient, telegram_id: int, name: str) -> dict[str, str]:
    init_data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": telegram_id, "first_name": name, "username": f"user{telegram_id}"},
    )
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _profile(client: AsyncClient, headers: dict[str, str], name: str) -> None:
    response = await client.post("/api/v1/coach/profile", headers=headers, json={"display_name": name})
    assert response.status_code == 201, response.text


async def _template(client: AsyncClient, headers: dict[str, str], name: str) -> int:
    response = await client.post("/api/v1/workouts/templates", headers=headers, json={
        "name": name, "type": "strength", "is_public": False,
        "exercises": [{"exercise_id": 1, "name": "Push-up", "sets": 3, "reps": 10, "rest_seconds": 60}],
    })
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


async def _connected_pair(client: AsyncClient, coach_headers: dict[str, str], client_headers: dict[str, str]) -> int:
    invitation = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    assert invitation.status_code == 201, invitation.text
    accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": invitation.json()["token"]})
    assert accepted.status_code == 200, accepted.text
    return accepted.json()["client_id"]


@pytest.mark.integration
async def test_coach_program_version_authorization_assignment_and_workout_bridge(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach_headers = await _headers(client, 960001, "Coach")
    client_headers = await _headers(client, 960002, "Client")
    other_headers = await _headers(client, 960003, "Other")
    await _profile(client, coach_headers, "Coach One")
    await _profile(client, other_headers, "Coach Two")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    owned_template = await _template(client, coach_headers, "Day A")
    foreign_template = await _template(client, other_headers, "Foreign")

    created = await client.post("/api/v1/coach/programs", headers=coach_headers, json={"name": "Base plan", "description": "Four weeks"})
    assert created.status_code == 201, created.text
    program_id = created.json()["id"]
    assert created.json()["version"] == 1
    foreign_view = await client.get(f"/api/v1/coach/programs/{program_id}", headers=other_headers)
    assert foreign_view.status_code == 404
    draft_assignment = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach_headers, json={"client_id": client_id})
    assert draft_assignment.status_code == 409

    foreign_day = await client.post(f"/api/v1/coach/programs/{program_id}/days", headers=coach_headers, json={"day_number": 1, "name": "Foreign", "workout_template_id": foreign_template})
    assert foreign_day.status_code == 404
    first_day = await client.post(f"/api/v1/coach/programs/{program_id}/days", headers=coach_headers, json={"day_number": 2, "name": "Day 2", "workout_template_id": owned_template, "notes": "Keep form", "position": 1})
    assert first_day.status_code == 201, first_day.text
    second_day = await client.post(f"/api/v1/coach/programs/{program_id}/days", headers=coach_headers, json={"day_number": 1, "name": "Day 1", "workout_template_id": owned_template, "position": 0})
    assert second_day.status_code == 201, second_day.text
    ordered_days = second_day.json()["days"]
    assert [day["day_number"] for day in ordered_days] == [1, 2]
    assert second_day.json()["version"] == 3
    day_id = ordered_days[0]["id"]

    activated = await client.post(f"/api/v1/coach/programs/{program_id}/activate", headers=coach_headers)
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == "ACTIVE"
    immutable = await client.patch(f"/api/v1/coach/programs/{program_id}", headers=coach_headers, json={"name": "Changed"})
    assert immutable.status_code == 409
    assigned = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach_headers, json={"client_id": client_id, "coach_message": "Welcome"})
    assert assigned.status_code == 201, assigned.text
    assignment_id = assigned.json()["id"]
    assert assigned.json()["program_version"] == activated.json()["version"]
    duplicate = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach_headers, json={"client_id": client_id})
    assert duplicate.status_code == 409
    other_assign = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=other_headers, json={"client_id": client_id})
    assert other_assign.status_code == 404

    my_programs = await client.get("/api/v1/client/coach-programs", headers=client_headers)
    assert my_programs.status_code == 200 and [item["id"] for item in my_programs.json()] == [assignment_id]
    foreign_programs = await client.get("/api/v1/client/coach-programs", headers=other_headers)
    assert foreign_programs.status_code == 200 and foreign_programs.json() == []
    idor = await client.get(f"/api/v1/client/coach-programs/{assignment_id}", headers=other_headers)
    assert idor.status_code == 404

    key = f"coach-program-start-{uuid4().hex}"
    started = await client.post(f"/api/v1/client/coach-programs/{assignment_id}/days/{day_id}/start", headers={**client_headers, "Idempotency-Key": key})
    assert started.status_code == 200, started.text
    replay = await client.post(f"/api/v1/client/coach-programs/{assignment_id}/days/{day_id}/start", headers={**client_headers, "Idempotency-Key": key})
    assert replay.status_code == 200 and replay.json()["workout_session_id"] == started.json()["workout_session_id"]
    metadata = started.json()["source_metadata"]
    assert metadata == {
        "assignment_id": assignment_id, "program_id": program_id,
        "program_version": assigned.json()["program_version"], "program_day_id": day_id,
        "workout_template_id": owned_template,
    }
    persisted_session = await client.get(f"/api/v1/workouts/history/{started.json()['workout_session_id']}", headers=client_headers)
    assert persisted_session.status_code == 200, persisted_session.text
    assert persisted_session.json()["source_type"] == "coach_program"
    assert persisted_session.json()["source_id"] == assignment_id

    paused = await client.patch(f"/api/v1/coach/assignments/{assignment_id}", headers=coach_headers, json={"status": "PAUSED"})
    assert paused.status_code == 200 and paused.json()["paused_at"]
    blocked_start = await client.post(f"/api/v1/client/coach-programs/{assignment_id}/days/{day_id}/start", headers={**client_headers, "Idempotency-Key": "new-start-after-pause"})
    assert blocked_start.status_code == 409
    resumed = await client.patch(f"/api/v1/coach/assignments/{assignment_id}", headers=coach_headers, json={"status": "ACTIVE"})
    assert resumed.status_code == 200
    completed = await client.patch(f"/api/v1/coach/assignments/{assignment_id}", headers=coach_headers, json={"status": "COMPLETED"})
    assert completed.status_code == 200 and completed.json()["completed_at"]
    terminal = await client.patch(f"/api/v1/coach/assignments/{assignment_id}", headers=coach_headers, json={"status": "ACTIVE"})
    assert terminal.status_code == 409


@pytest.mark.integration
async def test_coach_program_concurrent_start_reuses_workout_session(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach_headers = await _headers(client, 961001, "Coach")
    client_headers = await _headers(client, 961002, "Client")
    await _profile(client, coach_headers, "Coach")
    client_id = await _connected_pair(client, coach_headers, client_headers)
    template_id = await _template(client, coach_headers, "Plan day")
    program = await client.post("/api/v1/coach/programs", headers=coach_headers, json={"name": "Concurrency", "days": [{"day_number": 1, "name": "Day 1", "workout_template_id": template_id}]})
    assert program.status_code == 201, program.text
    program_id = program.json()["id"]
    day_id = program.json()["days"][0]["id"]
    assert (await client.post(f"/api/v1/coach/programs/{program_id}/activate", headers=coach_headers)).status_code == 200
    assignment = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach_headers, json={"client_id": client_id})
    assignment_id = assignment.json()["id"]
    path = f"/api/v1/client/coach-programs/{assignment_id}/days/{day_id}/start"
    headers = {**client_headers, "Idempotency-Key": f"simultaneous-start-{uuid4().hex}"}
    results = await asyncio.gather(client.post(path, headers=headers), client.post(path, headers=headers))
    assert [result.status_code for result in results] == [200, 200]
    assert results[0].json()["workout_session_id"] == results[1].json()["workout_session_id"]
