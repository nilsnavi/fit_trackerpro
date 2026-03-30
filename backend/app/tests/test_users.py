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
    """Stats under /users/me/stats are not implemented yet."""
    response = await authenticated_client.get("/api/v1/users/me/stats")
    assert response.status_code == 404


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
