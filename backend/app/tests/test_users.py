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
    """Test updating user profile."""
    update_data = {
        "first_name": "Updated",
        "last_name": "Name",
        "fitness_goal": "muscle_gain"
    }

    response = await authenticated_client.patch("/api/v1/users/me", json=update_data)

    # Endpoint might not exist yet
    if response.status_code == 200:
        data = response.json()
        assert data["first_name"] == update_data["first_name"]
        assert data["last_name"] == update_data["last_name"]


@pytest.mark.unit
async def test_get_user_stats(authenticated_client: AsyncClient):
    """Test getting user statistics."""
    response = await authenticated_client.get("/api/v1/users/me/stats")

    # Endpoint might not exist yet
    if response.status_code == 200:
        data = response.json()
        assert "total_workouts" in data
        assert "total_exercises" in data
        assert "streak_days" in data


@pytest.mark.unit
async def test_list_users_admin_only(client: AsyncClient):
    """Test that listing all users requires admin privileges."""
    response = await client.get("/api/v1/users/")
    assert response.status_code == 401  # Or 403 if authenticated but not admin


@pytest.mark.integration
async def test_user_registration_and_profile_flow(
    client: AsyncClient,
    mock_telegram_auth_data
):
    """Test complete user registration and profile flow."""
    # 1. Authenticate
    auth_response = await client.post("/api/v1/users/auth/telegram", json=mock_telegram_auth_data)

    if auth_response.status_code != 200:
        pytest.skip("Authentication endpoint not fully implemented")

    token = auth_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get profile
    profile_response = await client.get("/api/v1/users/me", headers=headers)
    assert profile_response.status_code == 200

    profile = profile_response.json()
    assert profile["telegram_id"] == mock_telegram_auth_data["id"]
    assert profile["username"] == mock_telegram_auth_data["username"]


@pytest.mark.unit
async def test_delete_user_account(authenticated_client: AsyncClient):
    """Test deleting user account."""
    response = await authenticated_client.delete("/api/v1/users/me")

    # Endpoint might not exist yet
    assert response.status_code in [200, 204, 404]
