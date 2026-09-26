"""Challenge participation is not implemented — the API must not pretend otherwise.

Before: ``join`` answered "Successfully joined the challenge!" with a hard-coded
``participant_count=46`` and stored nothing; ``leave`` did nothing; leaderboard and
``my/active`` were always empty. The Mini App now hides challenges, and these
endpoints answer 501 until participants and progress tracking exist.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


@pytest.mark.parametrize("prefix", ["/api/v1/challenges", "/api/v1/analytics/challenges"])
async def test_participation_endpoints_answer_501(
    authenticated_client: AsyncClient, prefix: str
) -> None:
    created = await authenticated_client.post(
        f"{prefix}/",
        json={
            "name": "Неделя без пропусков",
            "type": "workout_count",
            "goal": {"type": "count", "target": 5, "unit": "workouts"},
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=7)).isoformat(),
            "is_public": True,
        },
    )
    assert created.status_code == 201, created.text
    challenge_id = created.json()["id"]

    for method, path in (
        ("post", f"{prefix}/{challenge_id}/join"),
        ("post", f"{prefix}/{challenge_id}/leave"),
        ("get", f"{prefix}/{challenge_id}/leaderboard"),
        ("get", f"{prefix}/my/active"),
    ):
        response = await getattr(authenticated_client, method)(path)
        assert response.status_code == 501, f"{method.upper()} {path}: {response.text}"
        assert response.json()["error"]["code"] == "not_implemented"
