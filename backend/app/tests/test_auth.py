import pytest
from httpx import AsyncClient

from app.settings import settings
from app.tests.telegram_webapp import build_init_data

# Не совпадает с authenticated_client (123456789), иначе интеграционный тест «новый пользователь»
# падает после любого теста, уже создавшего пользователя в общей in-memory БД.
_AUTH_FLOW_UNIQUE_TG_ID = 910_010_020


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
    body = response.json()
    assert "error" in body
    assert "Подпись" in body["error"]["message"] or "недействительна" in body["error"]["message"]


@pytest.mark.unit
@pytest.mark.auth
async def test_telegram_lookup_unregistered(client: AsyncClient, mock_telegram_user: dict):
    """Lookup does not create a user and reports registered=false."""
    fresh_user = {**mock_telegram_user, "id": 910_010_030}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=fresh_user)
    response = await client.post("/api/v1/users/auth/lookup", json={"init_data": init_data})
    assert response.status_code == 200
    assert response.json()["registered"] is False


@pytest.mark.integration
@pytest.mark.auth
async def test_telegram_lookup_registered_after_login(client: AsyncClient, mock_telegram_user: dict):
    """After telegram auth, lookup reports registered=true."""
    fresh_user = {**mock_telegram_user, "id": 910_010_031}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=fresh_user)
    login = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert login.status_code == 200

    lookup = await client.post("/api/v1/users/auth/lookup", json={"initData": init_data})
    assert lookup.status_code == 200
    assert lookup.json()["registered"] is True


@pytest.mark.integration
@pytest.mark.auth
async def test_register_endpoint_returns_tokens(client: AsyncClient, mock_telegram_user: dict):
    """POST /register behaves like POST /telegram for Mini App registration."""
    fresh_user = {**mock_telegram_user, "id": 910_010_032}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=fresh_user)
    response = await client.post("/api/v1/users/auth/register", json={"initData": init_data})
    assert response.status_code == 200
    data = response.json()
    assert data.get("access_token") or data.get("token")
    assert data.get("is_new_user") is True


@pytest.mark.unit
@pytest.mark.auth
async def test_telegram_auth_accepts_init_data_camel_case(client: AsyncClient, mock_telegram_user: dict):
    """POST body may use camelCase initData (Mini App contract)."""
    init = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=mock_telegram_user)
    response = await client.post(
        "/api/v1/users/auth/telegram",
        json={"initData": init},
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("access_token") or data.get("token")


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
async def test_authentication_flow(client: AsyncClient, mock_telegram_user: dict):
    """Telegram initData → JWT and access to /users/me."""
    fresh_user = {**mock_telegram_user, "id": _AUTH_FLOW_UNIQUE_TG_ID}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=fresh_user)
    response = await client.post(
        "/api/v1/users/auth/telegram",
        json={"init_data": init_data},
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("access_token")
    assert data.get("refresh_token")
    assert data.get("is_new_user") is True
    assert data.get("onboarding_required") is True
    token = data["access_token"]

    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200


@pytest.mark.integration
@pytest.mark.auth
async def test_onboarding_flow(client: AsyncClient, mock_telegram_auth_body: dict):
    """New user can save onboarding and it persists in profile."""
    auth_response = await client.post(
        "/api/v1/users/auth/telegram",
        json=mock_telegram_auth_body,
    )
    assert auth_response.status_code == 200
    token = auth_response.json()["access_token"]

    onboarding = await client.post(
        "/api/v1/users/auth/onboarding",
        headers={"Authorization": f"Bearer {token}"},
        json={"fitness_goal": "strength", "experience_level": "beginner"},
    )
    assert onboarding.status_code == 200
    onboarding_data = onboarding.json()
    assert onboarding_data["success"] is True
    assert onboarding_data["profile"]["fitness_goal"] == "strength"
    assert onboarding_data["profile"]["experience_level"] == "beginner"
    assert onboarding_data["profile"]["onboarding_completed"] is True

    re_auth = await client.post(
        "/api/v1/users/auth/telegram",
        json=mock_telegram_auth_body,
    )
    assert re_auth.status_code == 200
    re_auth_data = re_auth.json()
    assert re_auth_data.get("is_new_user") is False
    assert re_auth_data.get("onboarding_required") is False


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


@pytest.mark.integration
@pytest.mark.auth
async def test_token_refresh_happy_path(client: AsyncClient, mock_telegram_auth_body: dict):
    """Valid refresh token returns new token pair that grants access to /me."""
    # Authenticate to get initial tokens
    auth_resp = await client.post(
        "/api/v1/users/auth/telegram",
        json=mock_telegram_auth_body,
    )
    assert auth_resp.status_code == 200
    refresh_token = auth_resp.json()["refresh_token"]
    assert refresh_token

    # Refresh
    refresh_resp = await client.post(
        "/api/v1/users/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    refresh_data = refresh_resp.json()
    new_access = refresh_data["access_token"]
    new_refresh = refresh_data["refresh_token"]
    assert new_access
    assert new_refresh
    assert refresh_data["token_type"] == "bearer"
    assert refresh_data["expires_in"] > 0

    # New access token works for /me
    me_resp = await client.get(
        "/api/v1/users/auth/me",
        headers={"Authorization": f"Bearer {new_access}"},
    )
    assert me_resp.status_code == 200


@pytest.mark.unit
@pytest.mark.auth
async def test_token_refresh_invalid_token(client: AsyncClient):
    """Refresh with a garbage token returns 401 or 422."""
    response = await client.post(
        "/api/v1/users/auth/refresh",
        json={"refresh_token": "not-a-valid-jwt"},
    )
    # Server may reject at validation (422) or auth (401) layer
    assert response.status_code in (401, 422)
