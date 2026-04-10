import pytest
from httpx import AsyncClient


@pytest.mark.unit
async def test_get_current_user(authenticated_client: AsyncClient):
    """Test getting current user profile."""
    response = await authenticated_client.get("/api/v1/users/me")
    assert response.status_code == 200

    data = response.json()
    assert "id" in data
    assert "telegram_id" in data
    assert "username" in data


@pytest.mark.unit
async def test_update_user_profile(authenticated_client: AsyncClient):
    """Test updating user profile (schema-aligned fields)."""
    update_data = {
        "first_name": "Updated",
        "profile": {"goals": ["muscle_gain"]},
    }

    response = await authenticated_client.patch(
        "/api/v1/users/me",
        json=update_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == update_data["first_name"]
    assert "muscle_gain" in (data.get("profile") or {}).get("goals", [])

@pytest.mark.integration
async def test_profile_patch_persists_between_requests(authenticated_client: AsyncClient):
    """PATCH /users/me then GET /users/me must reflect persisted fields."""
    patch = await authenticated_client.patch(
        "/api/v1/users/me",
        json={"first_name": "Persisted", "profile": {"goals": ["cutting"]}},
    )
    assert patch.status_code == 200, patch.text

    fetched = await authenticated_client.get("/api/v1/users/me")
    assert fetched.status_code == 200, fetched.text
    data = fetched.json()
    assert data.get("first_name") == "Persisted"
    assert "cutting" in (data.get("profile") or {}).get("goals", [])


@pytest.mark.unit
async def test_get_user_stats(authenticated_client: AsyncClient):
    """Stats endpoint returns analytics-backed shape."""
    response = await authenticated_client.get("/api/v1/users/me/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_workouts" in data
    assert "total_duration" in data
    assert "current_streak" in data


@pytest.mark.unit
async def test_list_users_admin_only(client: AsyncClient):
    """No public GET /users list — 405 or auth-related codes."""
    response = await client.get("/api/v1/users/")
    assert response.status_code in (401, 403, 405)


@pytest.mark.integration
async def test_user_registration_and_profile_flow(
    client: AsyncClient,
    mock_telegram_auth_body: dict,
    mock_telegram_user: dict,
):
    """initData auth then /users/me."""
    auth_response = await client.post(
        "/api/v1/users/auth/telegram",
        json=mock_telegram_auth_body,
    )
    assert auth_response.status_code == 200

    token = auth_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profile_response = await client.get("/api/v1/users/me", headers=headers)
    assert profile_response.status_code == 200

    profile = profile_response.json()
    assert profile["telegram_id"] == mock_telegram_user["id"]
    assert profile["username"] == mock_telegram_user["username"]


@pytest.mark.unit
async def test_delete_user_account(authenticated_client: AsyncClient):
    """Delete current user returns 204."""
    response = await authenticated_client.delete("/api/v1/users/me")
    assert response.status_code == 204


@pytest.mark.integration
async def test_public_create_user_upsert_and_get_by_id(client: AsyncClient):
    created = await client.post(
        "/api/v1/users/",
        json={
            "telegram_id": 777001,
            "username": "upsert_user",
            "first_name": "First",
            "last_name": "IgnoredByDomain",
        },
    )
    assert created.status_code == 200, created.text
    created_data = created.json()
    assert created_data["telegram_id"] == 777001
    assert created_data["username"] == "upsert_user"

    updated = await client.post(
        "/api/v1/users/",
        json={
            "telegram_id": 777001,
            "username": "upsert_user_v2",
            "first_name": "Second",
        },
    )
    assert updated.status_code == 200, updated.text
    updated_data = updated.json()
    assert updated_data["id"] == created_data["id"]
    assert updated_data["username"] == "upsert_user_v2"
    assert updated_data["first_name"] == "Second"

    fetched = await client.get(f"/api/v1/users/{created_data['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["username"] == "upsert_user_v2"


@pytest.mark.integration
async def test_get_user_by_id_returns_404_for_missing_user(client: AsyncClient):
    response = await client.get("/api/v1/users/999999")
    assert response.status_code == 404
    assert response.json().get("error", {}).get("code") == "user_not_found"


@pytest.mark.integration
async def test_coach_access_generate_list_revoke(authenticated_client: AsyncClient):
    generated = await authenticated_client.post("/api/v1/users/coach-access/generate")
    assert generated.status_code == 200, generated.text
    generated_data = generated.json()
    assert "code" in generated_data
    assert "expires_at" in generated_data

    listed = await authenticated_client.get("/api/v1/users/coach-access")
    assert listed.status_code == 200, listed.text
    listed_data = listed.json()
    assert isinstance(listed_data, list)
    assert len(listed_data) >= 1
    access_id = listed_data[0]["id"]

    revoked = await authenticated_client.delete(f"/api/v1/users/coach-access/{access_id}")
    assert revoked.status_code == 204, revoked.text

    listed_after = await authenticated_client.get("/api/v1/users/coach-access")
    assert listed_after.status_code == 200, listed_after.text
    assert all(item["id"] != access_id for item in listed_after.json())


@pytest.mark.integration
async def test_export_contains_profile_and_basic_entities(authenticated_client: AsyncClient):
    response = await authenticated_client.get("/api/v1/users/export")
    assert response.status_code == 200, response.text
    assert response.headers.get("content-type", "").startswith("application/json")

    data = response.json()
    assert "exported_at" in data
    assert "user" in data
    assert "summary" in data
    assert "templates" in data
    assert "recent_workouts" in data
    assert data["user"]["telegram_id"] > 0
