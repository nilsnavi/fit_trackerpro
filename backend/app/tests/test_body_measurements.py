import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_body_measurements_crud(authenticated_client: AsyncClient):
    """Body measurements are stored as dated health records, not profile JSON."""
    created = await authenticated_client.post(
        "/api/v1/health/body-measurements",
        json={
            "measurement_type": "chest",
            "value_cm": 101.5,
            "measured_at": "2026-05-02",
        },
    )
    assert created.status_code == 201, created.text
    created_data = created.json()
    assert created_data["measurement_type"] == "chest"
    assert created_data["value_cm"] == 101.5
    assert created_data["measured_at"] == "2026-05-02"

    updated = await authenticated_client.patch(
        f"/api/v1/health/body-measurements/{created_data['id']}",
        json={"value_cm": 102, "measured_at": "2026-05-03"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["value_cm"] == 102
    assert updated.json()["measured_at"] == "2026-05-03"

    history = await authenticated_client.get("/api/v1/health/body-measurements")
    assert history.status_code == 200, history.text
    assert history.json()["total"] >= 1
    assert any(item["id"] == created_data["id"] for item in history.json()["items"])

    latest = await authenticated_client.get(
        "/api/v1/health/body-measurements",
        params={"latest": "true"},
    )
    assert latest.status_code == 200, latest.text
    assert any(item["measurement_type"] == "chest" for item in latest.json()["items"])

    deleted = await authenticated_client.delete(
        f"/api/v1/health/body-measurements/{created_data['id']}"
    )
    assert deleted.status_code == 204, deleted.text
