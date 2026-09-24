"""Onboarding must not store health data without recorded consent (WS1-14).

The app keeps pulse, glucose, weight, sleep and wellbeing — sensitive data.
Onboarding therefore requires an explicit consent flag, and the accepted version
plus timestamp are stored in ``users.profile`` so that the agreement can be
proven later.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.legal import HEALTH_DATA_CONSENT_VERSION

pytestmark = pytest.mark.asyncio

ONBOARDING = "/api/v1/users/auth/onboarding"


async def _auth_token(client: AsyncClient, mock_telegram_auth_body: dict) -> str:
    response = await client.post("/api/v1/users/auth/telegram", json=mock_telegram_auth_body)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _payload(**overrides) -> dict:
    data = {"fitness_goal": "strength", "experience_level": "beginner"}
    data.update(overrides)
    return data


async def test_onboarding_without_consent_is_rejected(
    client: AsyncClient, mock_telegram_auth_body: dict
) -> None:
    token = await _auth_token(client, mock_telegram_auth_body)

    response = await client.post(
        ONBOARDING,
        headers={"Authorization": f"Bearer {token}"},
        json=_payload(),
    )

    assert response.status_code == 400, response.text
    body = response.json()
    assert "consent" in str(body).lower()

    # Nothing was stored: the user still has to pass onboarding.
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["profile"].get("consent") is None


async def test_consent_is_recorded_with_version_and_timestamp(
    client: AsyncClient, mock_telegram_auth_body: dict
) -> None:
    token = await _auth_token(client, mock_telegram_auth_body)

    response = await client.post(
        ONBOARDING,
        headers={"Authorization": f"Bearer {token}"},
        json=_payload(health_data_consent=True, consent_version="2026-01-01"),
    )

    assert response.status_code == 200, response.text
    consent = response.json()["profile"]["consent"]
    assert consent["version"] == "2026-01-01"
    assert consent["source"] == "onboarding"
    assert consent["accepted_at"]

    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["profile"]["consent"]["version"] == "2026-01-01"


async def test_consent_version_defaults_to_current_text(
    client: AsyncClient, mock_telegram_auth_body: dict
) -> None:
    token = await _auth_token(client, mock_telegram_auth_body)

    response = await client.post(
        ONBOARDING,
        headers={"Authorization": f"Bearer {token}"},
        json=_payload(health_data_consent=True),
    )

    assert response.status_code == 200, response.text
    assert response.json()["profile"]["consent"]["version"] == HEALTH_DATA_CONSENT_VERSION


async def test_repeated_onboarding_keeps_the_original_consent_timestamp(
    client: AsyncClient, mock_telegram_auth_body: dict
) -> None:
    token = await _auth_token(client, mock_telegram_auth_body)
    headers = {"Authorization": f"Bearer {token}"}

    first = await client.post(
        ONBOARDING,
        headers=headers,
        json=_payload(health_data_consent=True, consent_version="2026-09-23"),
    )
    accepted_at = first.json()["profile"]["consent"]["accepted_at"]

    second = await client.post(
        ONBOARDING,
        headers=headers,
        json=_payload(fitness_goal="endurance"),
    )

    assert second.status_code == 200, second.text
    consent = second.json()["profile"]["consent"]
    assert consent["accepted_at"] == accepted_at
    assert consent["version"] == "2026-09-23"
