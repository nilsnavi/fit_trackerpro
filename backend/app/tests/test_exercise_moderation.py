"""Moderation of user-submitted exercises.

* ``is_admin`` comes from the server (``ADMIN_USER_IDS``) — the Mini App no longer
  guesses it from build-time env or ``localStorage``;
* the moderation queue (``status=pending``) is visible in full only to admins,
  everyone else sees just their own submissions;
* approve / reject stay admin-only.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.settings import settings
from app.tests import conftest as test_conftest

pytestmark = pytest.mark.asyncio

ADMIN_TG_ID = 123456789  # the id ``authenticated_client`` logs in with
AUTHOR_TG_ID = 700700700


async def _author_headers(client: AsyncClient) -> dict[str, str]:
    token = await test_conftest.TestUser(client, telegram_id=AUTHOR_TG_ID).authenticate()
    return {"Authorization": f"Bearer {token}"}


def _exercise(name: str) -> dict:
    return {
        "name": name,
        "category": "strength",
        "description": "Submitted for moderation.",
        "equipment": ["dumbbells"],
        "muscle_groups": ["Chest"],
        "risk_flags": {
            "high_blood_pressure": False,
            "diabetes": False,
            "joint_problems": False,
            "back_problems": False,
            "heart_conditions": False,
        },
        "media_url": None,
    }


async def test_profile_reports_admin_flag_from_server_settings(
    authenticated_client: AsyncClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [], raising=False)
    assert (await authenticated_client.get("/api/v1/users/me")).json()["is_admin"] is False

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [ADMIN_TG_ID], raising=False)
    assert (await authenticated_client.get("/api/v1/users/me")).json()["is_admin"] is True
    assert (await authenticated_client.get("/api/v1/users/auth/me")).json()["is_admin"] is True


async def test_pending_queue_is_private_to_the_author_and_admins(
    authenticated_client: AsyncClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [], raising=False)
    author = await _author_headers(authenticated_client)
    submitted = await authenticated_client.post(
        "/api/v1/exercises/", json=_exercise("Жим на модерации"), headers=author
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["status"] == "pending"

    def names(response) -> set[str]:
        assert response.status_code == 200, response.text
        return {item["name"] for item in response.json()["items"]}

    # The author sees their own submission…
    mine = await authenticated_client.get(
        "/api/v1/exercises/", params={"status": "pending", "page_size": 100}, headers=author
    )
    assert "Жим на модерации" in names(mine)

    # …another regular user does not, not even through status=all.
    for status in ("pending", "all"):
        other = await authenticated_client.get(
            "/api/v1/exercises/", params={"status": status, "page_size": 100}
        )
        assert "Жим на модерации" not in names(other)

    # The admin sees the whole queue.
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [ADMIN_TG_ID], raising=False)
    queue = await authenticated_client.get(
        "/api/v1/exercises/", params={"status": "pending", "page_size": 100}
    )
    assert "Жим на модерации" in names(queue)


async def test_only_admins_approve_or_reject(
    authenticated_client: AsyncClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [], raising=False)
    author = await _author_headers(authenticated_client)
    first = (
        await authenticated_client.post(
            "/api/v1/exercises/", json=_exercise("На одобрение"), headers=author
        )
    ).json()
    second = (
        await authenticated_client.post(
            "/api/v1/exercises/", json=_exercise("На отказ"), headers=author
        )
    ).json()

    denied = await authenticated_client.post(
        f"/api/v1/exercises/{first['id']}/approve", headers=author
    )
    assert denied.status_code == 403

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [ADMIN_TG_ID], raising=False)
    approved = await authenticated_client.post(f"/api/v1/exercises/{first['id']}/approve")
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "active"

    rejected = await authenticated_client.delete(f"/api/v1/exercises/{second['id']}")
    assert rejected.status_code == 204
    gone = await authenticated_client.get(f"/api/v1/exercises/{second['id']}")
    assert gone.status_code == 404
