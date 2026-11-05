from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import event, text

from app.settings import settings
from app.tests.conftest import TestingSessionLocal
from app.tests.telegram_webapp import build_init_data


async def _auth(client: AsyncClient, telegram_id: int, name: str) -> dict[str, str]:
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": telegram_id, "first_name": name, "username": f"monitor{telegram_id}"})
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _relationship(client: AsyncClient, coach_headers: dict[str, str], client_headers: dict[str, str]) -> int:
    await client.post("/api/v1/coach/profile", headers=coach_headers, json={"display_name": "Coach"})
    invitation = await client.post("/api/v1/coach/invitations", headers=coach_headers, json={})
    accepted = await client.post("/api/v1/coach/invitations/accept", headers=client_headers,
        json={"token": invitation.json()["token"]})
    assert accepted.status_code == 200, accepted.text
    return accepted.json()["client_id"]


@pytest.mark.integration
async def test_monitoring_access_rules_search_pagination_and_postgres_query_count(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _auth(client, 973001, "Coach")
    other_coach = await _auth(client, 973002, "Other Coach")
    client_headers = [await _auth(client, 973100 + index, f"Client {index:02}") for index in range(31)]
    client_ids = []
    for headers in client_headers:
        client_ids.append(await _relationship(client, coach, headers))
    foreign_id = await _relationship(client, other_coach, await _auth(client, 973999, "Foreign"))

    query_count = 0
    def count_queries(*_args):
        nonlocal query_count
        query_count += 1
    sync_engine = TestingSessionLocal.kw["bind"].sync_engine
    event.listen(sync_engine, "before_cursor_execute", count_queries)
    try:
        response = await client.get("/api/v1/coach/monitoring?limit=20", headers=coach)
    finally:
        event.remove(sync_engine, "before_cursor_execute", count_queries)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 31
    assert len(data["items"]) == 20
    assert len({item["client_id"] for item in data["items"]}) == 20
    assert query_count <= 4, f"monitoring should use a bounded number of queries, got {query_count}"
    assert all("glucose" not in str(item).lower() for item in data["items"])

    second_page = await client.get("/api/v1/coach/monitoring?limit=20&offset=20", headers=coach)
    assert second_page.status_code == 200 and second_page.json()["total"] == 31
    assert len(second_page.json()["items"]) == 11
    hidden = await client.get(f"/api/v1/coach/monitoring/{foreign_id}", headers=coach)
    assert hidden.status_code == 404
    no_search_bypass = await client.get("/api/v1/coach/monitoring?search=Foreign", headers=coach)
    assert no_search_bypass.status_code == 200 and no_search_bypass.json()["total"] == 0

    recent = await client.post("/api/v1/workouts/sessions", headers=client_headers[0], json={"name": "Recent"})
    assert recent.status_code == 201, recent.text
    await db_session.execute(text("UPDATE workout_logs SET status='completed', completed_at=:when WHERE id=:id"),
        {"when": datetime.now(UTC) - timedelta(days=1), "id": recent.json()["id"]})
    paused_recent = await client.post("/api/v1/workouts/sessions", headers=client_headers[1], json={"name": "Recent paused client"})
    assert paused_recent.status_code == 201, paused_recent.text
    await db_session.execute(text("UPDATE workout_logs SET status='completed', completed_at=:when WHERE id=:id"),
        {"when": datetime.now(UTC) - timedelta(days=1), "id": paused_recent.json()["id"]})
    await db_session.commit()
    item = await client.get(f"/api/v1/coach/monitoring/{client_ids[0]}", headers=coach)
    assert item.status_code == 200
    assert "NO_RECENT_WORKOUT" not in {signal["code"] for signal in item.json()["signals"]}

    paused = await client.patch(f"/api/v1/coach/clients/{client_ids[1]}", headers=coach, json={"status": "PAUSED"})
    assert paused.status_code == 200
    listing = await client.get("/api/v1/coach/monitoring?status=attention", headers=coach)
    assert listing.json()["attention_count"] == 30
    assert listing.json()["ok_count"] == 1
    paused_item = next(entry for entry in listing.json()["items"] if entry["client_id"] == client_ids[1])
    assert "RELATIONSHIP_PAUSED" in {signal["code"] for signal in paused_item["signals"]}
    paused_detail = await client.get(f"/api/v1/coach/monitoring/{client_ids[1]}", headers=coach)
    assert paused_detail.status_code == 200
    assert paused_detail.json()["relationship_status"] == "PAUSED"


@pytest.mark.integration
async def test_monitoring_does_not_carry_assignment_across_archived_relationship(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _auth(client, 974001, "Coach")
    client_headers = await _auth(client, 974002, "Client")
    client_id = await _relationship(client, coach, client_headers)
    relationship_a_id = (await db_session.execute(
        text("SELECT id FROM coach_clients WHERE coach_id=(SELECT id FROM users WHERE telegram_id=974001) AND client_id=(SELECT id FROM users WHERE telegram_id=974002) AND status='ACTIVE'")
    )).scalar_one()

    template = await client.post("/api/v1/workouts/templates", headers=coach, json={
        "name": "Monitoring template", "type": "strength", "is_public": False,
        "exercises": [{"exercise_id": 1, "name": "Push-up", "sets": 3, "reps": 10, "rest_seconds": 60}],
    })
    assert template.status_code in (200, 201), template.text
    program = await client.post("/api/v1/coach/programs", headers=coach, json={"name": "Monitoring program"})
    assert program.status_code == 201, program.text
    program_id = program.json()["id"]
    day = await client.post(f"/api/v1/coach/programs/{program_id}/days", headers=coach, json={
        "day_number": 1, "name": "Day 1", "workout_template_id": template.json()["id"],
    })
    assert day.status_code == 201, day.text
    activated = await client.post(f"/api/v1/coach/programs/{program_id}/activate", headers=coach)
    assert activated.status_code == 200, activated.text
    assignment = await client.post(f"/api/v1/coach/programs/{program_id}/assignments", headers=coach, json={"client_id": client_id})
    assert assignment.status_code == 201, assignment.text
    assert assignment.json()["relationship_id"] == relationship_a_id

    paused = await client.patch(f"/api/v1/coach/clients/{client_id}", headers=coach, json={"status": "PAUSED"})
    assert paused.status_code == 200, paused.text
    paused_detail = await client.get(f"/api/v1/coach/monitoring/{client_id}", headers=coach)
    assert paused_detail.status_code == 200
    assert paused_detail.json()["relationship_status"] == "PAUSED"
    blocked_coach_update = await client.patch(
        f"/api/v1/coach/assignments/{assignment.json()['id']}", headers=coach, json={"status": "PAUSED"}
    )
    assert blocked_coach_update.status_code == 404
    day_id = (await db_session.execute(
        text("SELECT id FROM coach_program_days WHERE program_id=:program_id"), {"program_id": program_id}
    )).scalar_one()
    blocked_start = await client.post(
        f"/api/v1/client/coach-programs/{assignment.json()['id']}/days/{day_id}/start",
        headers={**client_headers, "Idempotency-Key": "paused-relationship-start"},
    )
    assert blocked_start.status_code == 404

    archived = await client.patch(f"/api/v1/coach/clients/{client_id}", headers=coach, json={"status": "ARCHIVED"})
    assert archived.status_code == 200, archived.text
    invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
    assert invite.status_code == 201, invite.text
    relationship_b = await client.post("/api/v1/coach/invitations/accept", headers=client_headers, json={"token": invite.json()["token"]})
    assert relationship_b.status_code == 200, relationship_b.text
    relationship_b_id = (await db_session.execute(
        text("SELECT id FROM coach_clients WHERE coach_id=(SELECT id FROM users WHERE telegram_id=974001) AND client_id=(SELECT id FROM users WHERE telegram_id=974002) AND status='ACTIVE'")
    )).scalar_one()
    assert relationship_b_id != relationship_a_id

    listing = await client.get("/api/v1/coach/monitoring", headers=coach)
    assert listing.status_code == 200, listing.text
    item = next(value for value in listing.json()["items"] if value["client_id"] == client_id)
    assert item["relationship_status"] == "ACTIVE"
    assert item["active_assignment"] is None
