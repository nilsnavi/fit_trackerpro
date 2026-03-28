import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.tests.telegram_webapp import build_init_data


@pytest.mark.unit
@pytest.mark.auth
async def test_telegram_auth_missing_data(client: AsyncClient):
    """Test authentication with missing data."""
    response = await client.post("/api/v1/users/auth/telegram", json={})
    assert response.status_code == 422


@pytest.mark.unit
@pytest.mark.auth
async def test_telegram_auth_invalid_hash(client: AsyncClient, mock_telegram_user: dict):
    """Invalid HMAC → 401."""
    bad_init = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user=mock_telegram_user,
        invalid_hash=True,
    )
    response = await client.post(
        "/api/v1/users/auth/telegram",
        json={"init_data": bad_init},
    )
    assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_protected_endpoint_without_auth(client: AsyncClient):
    """Protected profile without Authorization → 401."""
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_protected_endpoint_with_invalid_token(client: AsyncClient):
    """Bearer token that is not a valid JWT → 401."""
    headers = {"Authorization": "Bearer invalid_token"}
    response = await client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.integration
@pytest.mark.auth
async def test_authentication_flow(client: AsyncClient, mock_telegram_auth_body: dict):
    """Telegram initData → JWT and access to /users/me."""
    response = await client.post(
        "/api/v1/users/auth/telegram",
        json=mock_telegram_auth_body,
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("access_token")
    token = data["access_token"]

    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200


@pytest.mark.unit
@pytest.mark.auth
async def test_token_refresh(client: AsyncClient):
    """Refresh without body → validation error."""
    response = await client.post("/api/v1/users/auth/refresh", json={})
    assert response.status_code == 422


@pytest.mark.unit
@pytest.mark.auth
async def test_logout(client: AsyncClient):
    """Logout requires authentication."""
    response = await client.post("/api/v1/users/auth/logout")
    assert response.status_code == 401
