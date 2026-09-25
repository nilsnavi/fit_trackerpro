from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.application.analytics_service import AnalyticsService
from app.domain.workout_log import WorkoutLog
from app.settings import settings


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
    """Stats endpoint returns analytics-backed shape without untracked calories."""
    response = await authenticated_client.get("/api/v1/users/me/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_workouts" in data
    assert "total_duration" in data
    assert "current_streak" in data
    assert "active_days" in data
    # WS2-3: калории не считаются — поля в ответе нет, а не нулевая заглушка.
    assert "total_calories" not in data


async def _seed_workout_history(db_session, user_id: int) -> None:
    """Два активных дня внутри 30-дневного окна и один — за его пределами."""
    today = date.today()
    db_session.add_all(
        [
            WorkoutLog(user_id=user_id, date=today, duration=45, status="completed"),
            # Вторая тренировка в тот же день не должна удваивать активный день.
            WorkoutLog(user_id=user_id, date=today, duration=30, status="completed"),
            WorkoutLog(user_id=user_id, date=today - timedelta(days=2), duration=50, status="completed"),
            WorkoutLog(user_id=user_id, date=today - timedelta(days=45), duration=60, status="completed"),
        ]
    )
    await db_session.commit()


@pytest.mark.unit
async def test_get_active_days_counts_distinct_days(authenticated_client: AsyncClient, db_session):
    """WS2-3: active_days — уникальные дни с тренировками за окно, а не заглушка."""
    me = await authenticated_client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    user_id = me.json()["id"]

    service = AnalyticsService(db_session)
    assert await service.get_active_days(user_id=user_id, period="30d") == 0

    await _seed_workout_history(db_session, user_id)

    assert await service.get_active_days(user_id=user_id, period="30d") == 2
    assert await service.get_active_days(user_id=user_id, period="all") == 3


@pytest.mark.integration
async def test_user_stats_active_days_reflects_history(
    authenticated_client: AsyncClient,
    db_session,
):
    """WS2-3: эндпоинт статистики отдаёт реальные дни/объём, а не нули."""
    if str(settings.DATABASE_URL).startswith("sqlite"):
        pytest.skip(
            "Stats summary relies on PostgreSQL JSON/CTE features; skipped on SQLite."
        )

    me = await authenticated_client.get("/api/v1/users/me")
    assert me.status_code == 200, me.text
    await _seed_workout_history(db_session, me.json()["id"])

    response = await authenticated_client.get("/api/v1/users/me/stats")
    assert response.status_code == 200, response.text
    data = response.json()

    # active_days считается напрямую по истории и не зависит от кэша сводки аналитики
    # (в CI тот же пользователь уже мог закэшировать пустую сводку), поэтому проверяем
    # именно его — это и есть изменение WS2-3.
    assert data["active_days"] == 2
    assert "total_calories" not in data


@pytest.mark.unit
async def test_list_users_admin_only(client: AsyncClient):
    """No public GET /users list."""
    response = await client.get("/api/v1/users/")
    assert response.status_code == 404


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
async def test_anonymous_user_create_and_lookup_are_not_exposed(client: AsyncClient):
    create_response = await client.post(
        "/api/v1/users/",
        json={
            "telegram_id": 777001,
            "username": "upsert_user",
            "first_name": "First",
            "last_name": "IgnoredByDomain",
        },
    )
    assert create_response.status_code == 404

    lookup_response = await client.get("/api/v1/users/1")
    assert lookup_response.status_code == 404


@pytest.mark.integration
async def test_coach_access_endpoints_are_honest_501(authenticated_client: AsyncClient):
    """
    WS2-5: доступ тренера не реализован — эндпоинты отвечают 501.

    Раньше здесь выдавался код, который ничего не открывал, и UI обещал рабочий
    доступ к данным. Честнее не отдавать ничего, пока нет реального механизма.
    """
    generated = await authenticated_client.post("/api/v1/users/coach-access/generate")
    assert generated.status_code == 501, generated.text
    # Кода доступа в ответе нет — выдавать нечего.
    assert "code" not in generated.json()

    listed = await authenticated_client.get("/api/v1/users/coach-access")
    assert listed.status_code == 501, listed.text

    revoked = await authenticated_client.delete("/api/v1/users/coach-access/some-id")
    assert revoked.status_code == 501, revoked.text


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
