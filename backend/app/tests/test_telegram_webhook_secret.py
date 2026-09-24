"""
Telegram webhook hardening tests (WS1-12).

The reverse proxy intentionally skips rate limiting for /telegram/webhook, so the
``X-Telegram-Bot-Api-Secret-Token`` check is the only gate protecting the bot from
forged updates. These tests lock that contract in.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.settings import settings

WEBHOOK_PATH = "/telegram/webhook"
SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
SECRET_VALUE = "pytest-webhook-secret-value-123456"


@pytest.mark.integration
async def test_webhook_rejects_missing_secret_when_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", SECRET_VALUE)

    response = await client.post(WEBHOOK_PATH, json={"update_id": 1})

    assert response.status_code == 403


@pytest.mark.integration
async def test_webhook_rejects_wrong_secret(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", SECRET_VALUE)

    response = await client.post(
        WEBHOOK_PATH,
        json={"update_id": 1},
        headers={SECRET_HEADER: "wrong-secret-value"},
    )

    assert response.status_code == 403


@pytest.mark.integration
async def test_webhook_accepts_matching_secret(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", SECRET_VALUE)

    response = await client.post(
        WEBHOOK_PATH,
        json={"update_id": 1},
        headers={SECRET_HEADER: SECRET_VALUE},
    )

    assert response.status_code == 200


@pytest.mark.integration
async def test_webhook_stays_open_when_secret_not_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Dev/test compatibility: without a configured secret the endpoint keeps working.

    Production startup refuses this combination when the bot runtime is enabled
    (see ``Settings.reject_insecure_defaults_in_production``).
    """
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", None)

    response = await client.post(WEBHOOK_PATH, json={"update_id": 1})

    assert response.status_code == 200
