"""Coach read APIs expose no medical fields and obey exact client consent."""
from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _headers(client: AsyncClient, tg: int) -> dict[str, str]:
    data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user={"id": tg, "first_name": "Coach Read Test"},
    )
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": data})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.integration
async def test_coach_read_endpoints_are_strictly_scope_bound_and_hide_health(client: AsyncClient, db_session):
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    coach = await _headers(client, 983001)
    athlete = await _headers(client, 983002)
    outsider = await _headers(client, 983003)
    profile = await client.post("/api/v1/coach/profile", headers=coach, json={"display_name": "Read Coach"})
    assert profile.status_code == 201, profile.text
    other_profile = await client.post("/api/v1/coach/profile", headers=outsider, json={"display_name": "Other Coach"})
    assert other_profile.status_code == 201, other_profile.text
    invite = await client.post("/api/v1/coach/invitations", headers=coach, json={})
    assert invite.status_code == 201, invite.text
    joined = await client.post("/api/v1/coach/invitations/accept", headers=athlete, json={
        "token": invite.json()["token"],
    })
    assert joined.status_code == 200, joined.text
    athlete_id = joined.json()["client_id"]
    summary_path = f"/api/v1/coach/clients/{athlete_id}/training-summary"
    history_path = f"/api/v1/coach/clients/{athlete_id}/workout-history"
    assert (await client.get(summary_path, headers=coach)).status_code == 404
    assert (await client.get(history_path, headers=coach)).status_code == 404
    assert (await client.get(summary_path, headers=outsider)).status_code == 404

    workout = await client.post("/api/v1/workouts/sessions", headers=athlete, json={"name": "Session"})
    assert workout.status_code == 201, workout.text
    await db_session.execute(text(
        "UPDATE workout_logs SET status='completed', completed_at=:at, "
        "glucose_before=7.7, glucose_after=5.5, comments='private health note' "
        "WHERE id=:id"
    ), {"at": datetime.now(UTC), "id": workout.json()["id"]})
    await db_session.commit()

    base={"coach_id": profile.json()["user_id"], "consent_version": "v2-03c-1"}
    summary_grant=await client.post("/api/v1/client/coach-grants", headers=athlete, json={
        **base, "scope": "training_summary.read",
    })
    assert summary_grant.status_code == 201, summary_grant.text
    summary=await client.get(summary_path, headers=coach)
    assert summary.status_code == 200, summary.text
    assert summary.json()["completed_workouts"] == 1
    assert (await client.get(history_path, headers=coach)).status_code == 404
    assert "glucose" not in summary.text and "private health note" not in summary.text

    history_grant=await client.post("/api/v1/client/coach-grants", headers=athlete, json={
        **base, "scope": "workout_history.read",
    })
    assert history_grant.status_code == 201, history_grant.text
    history=await client.get(history_path, headers=coach)
    assert history.status_code == 200, history.text
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["id"] == workout.json()["id"]
    assert "glucose" not in history.text and "private health note" not in history.text
    assert "exercises" not in history.text
    assert (await client.get(history_path + "?limit=101", headers=coach)).status_code == 422

    revoked=await client.delete(
        f"/api/v1/client/coach-grants/{history_grant.json()['id']}", headers=athlete,
    )
    assert revoked.status_code == 204
    assert (await client.get(history_path, headers=coach)).status_code == 404
    assert (await client.get(summary_path, headers=coach)).status_code == 200
    assert (await client.get(history_path, headers=outsider)).status_code == 404
