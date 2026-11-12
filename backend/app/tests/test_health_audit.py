"""Medical-data read access is audit-logged (#190)."""
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.audit import HEALTH_DATA_READ
from app.settings import settings
from app.tests.telegram_webapp import build_init_data

_AUTH = "/api/v1/users/auth"


async def _login_token(client: AsyncClient, tg_id: int) -> str:
    user = {"id": tg_id, "first_name": "Audit", "username": f"audit{tg_id}"}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=user)
    response = await client.post(f"{_AUTH}/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.mark.unit
@pytest.mark.auth
async def test_reading_body_measurements_is_audited(client: AsyncClient):
    token = await _login_token(client, 940_000_001)
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.api.v1.health_metrics.audit_log") as audit:
        response = await client.get("/api/v1/health-metrics/body-measurements", headers=headers)

    assert response.status_code == 200, response.text
    audit.assert_called_once()
    kwargs = audit.call_args.kwargs
    assert kwargs["action"] == HEALTH_DATA_READ
    assert kwargs["meta"]["resource"] == "body_measurement"
    assert kwargs["meta"]["operation"] == "read"


@pytest.mark.unit
@pytest.mark.auth
async def test_reading_wellness_is_audited(client: AsyncClient):
    token = await _login_token(client, 940_000_002)
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.api.v1.health_metrics.audit_log") as audit:
        response = await client.get("/api/v1/health-metrics/wellness", headers=headers)

    assert response.status_code == 200, response.text
    audit.assert_called_once()
    assert audit.call_args.kwargs["meta"]["resource"] == "wellness"