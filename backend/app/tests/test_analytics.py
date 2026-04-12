from datetime import datetime

import pytest
from httpx import AsyncClient

from app.settings import settings


@pytest.mark.integration
class TestAnalyticsAuthBoundary:
    async def test_summary_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/summary")
        assert r.status_code == 401

    async def test_training_load_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/training-load/daily")
        assert r.status_code == 401

    async def test_export_requires_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/analytics/export", json={"format": "json"})
        assert r.status_code == 401

    async def test_progress_insights_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/progress-insights")
        assert r.status_code == 401

    async def test_workout_summary_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/workout-summary?workout_id=1")
        assert r.status_code == 401

    async def test_performance_overview_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/performance-overview")
        assert r.status_code == 401

    async def test_workouts_stats_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/workouts")
        assert r.status_code == 401


@pytest.mark.integration
class TestAnalyticsEmptyStateContracts:
    async def test_summary_contract_empty_db(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/summary?period=30d")
        assert r.status_code == 200, r.text
        data = r.json()

        assert data.get("total_workouts") == 0
        assert data.get("total_duration") == 0
        assert data.get("total_exercises") == 0
        assert data.get("current_streak") == 0
        assert data.get("longest_streak") == 0

        assert isinstance(data.get("personal_records"), list)
        assert isinstance(data.get("favorite_exercises"), list)

        assert "weekly_average" in data
        assert "monthly_average" in data

    async def test_training_load_daily_empty_list(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/training-load/daily")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    async def test_training_load_daily_table_contract(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/training-load/daily/table?page=1&page_size=30")
        assert r.status_code == 200, r.text
        data = r.json()

        assert isinstance(data.get("items"), list)
        assert "total" in data
        assert data.get("page") == 1
        assert data.get("pageSize") == 30
        assert "dateFrom" in data
        assert "dateTo" in data

    async def test_muscle_load_empty_list(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/muscle-load")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    async def test_muscle_load_table_contract(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/muscle-load/table?page=1&page_size=30")
        assert r.status_code == 200, r.text
        data = r.json()

        assert isinstance(data.get("items"), list)
        assert "total" in data
        assert data.get("page") == 1
        assert data.get("pageSize") == 30
        assert "dateFrom" in data
        assert "dateTo" in data

    async def test_recovery_state_contract(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/recovery-state")
        # On a fresh DB, recovery state may not exist yet.
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            data = r.json()
            assert "fatigueLevel" in data
            assert "readinessScore" in data
        else:
            data = r.json()
            assert (data.get("error") or {}).get("code") == "analytics_not_found"

    async def test_muscle_signals_envelope_contract(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/analytics/muscle-signals")
        # Depending on feature flags / DB views, this endpoint can be disabled.
        assert r.status_code in (200, 404), r.text
        data = r.json()
        if r.status_code == 200:
            assert "available" in data
            assert "signals" in data
        else:
            assert (data.get("error") or {}).get("code") == "analytics_not_found"

    async def test_progress_insights_contract(self, authenticated_client: AsyncClient):
        if str(settings.DATABASE_URL).startswith("sqlite"):
            pytest.skip("Progress insights relies on PostgreSQL JSON/CTE features; skipped on SQLite.")
        r = await authenticated_client.get("/api/v1/analytics/progress-insights?period=30d")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("period") == "30d"
        assert "date_from" in data
        assert "date_to" in data
        assert isinstance(data.get("summary"), dict)
        assert isinstance(data.get("volume_trend"), list)
        assert isinstance(data.get("frequency_trend"), list)
        assert isinstance(data.get("best_sets"), list)
        assert isinstance(data.get("pr_events"), list)

    async def test_performance_overview_contract(self, authenticated_client: AsyncClient):
        if str(settings.DATABASE_URL).startswith("sqlite"):
            pytest.skip("Performance overview relies on PostgreSQL JSON/CTE features; skipped on SQLite.")
        r = await authenticated_client.get("/api/v1/analytics/performance-overview?period=30d")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("period") == "30d"
        assert "date_from" in data
        assert "date_to" in data
        assert "total_workouts" in data
        assert "active_days" in data
        assert "average_workouts_per_week" in data
        assert "total_volume" in data
        assert "average_volume_per_workout" in data
        assert "baseline_estimated_1rm" in data
        assert "current_estimated_1rm" in data
        assert "estimated_1rm_progress_pct" in data
        assert isinstance(data.get("trend"), list)

    async def test_workout_summary_not_found_contract(self, authenticated_client: AsyncClient):
        if str(settings.DATABASE_URL).startswith("sqlite"):
            pytest.skip("Workout summary relies on PostgreSQL JSON/CTE features; skipped on SQLite.")
        r = await authenticated_client.get("/api/v1/analytics/workout-summary?workout_id=999999")
        assert r.status_code == 404, r.text
        data = r.json()
        assert (data.get("error") or {}).get("code") == "analytics_not_found"

    async def test_calendar_contract(self, authenticated_client: AsyncClient):
        # Calendar query uses PostgreSQL aggregates (e.g., bool_or) and isn't portable to SQLite.
        if str(settings.DATABASE_URL).startswith("sqlite"):
            pytest.skip("Calendar analytics relies on PostgreSQL-only functions; skipped on SQLite.")
        now = datetime.now()
        r = await authenticated_client.get(f"/api/v1/analytics/calendar?year={now.year}&month={now.month}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("year") == now.year
        assert data.get("month") == now.month
        assert isinstance(data.get("days"), list)
        assert isinstance(data.get("summary"), dict)
        if data.get("days"):
            day0 = data["days"][0]
            for key in [
                "date",
                "has_workout",
                "workout_count",
                "total_duration",
                "workout_types",
                "glucose_logged",
                "wellness_logged",
            ]:
                assert key in day0


@pytest.mark.integration
class TestAnalyticsExportFlow:
    async def test_export_then_check_status(self, authenticated_client: AsyncClient):
        create = await authenticated_client.post(
            "/api/v1/analytics/export",
            json={"format": "json"},
            headers={"Idempotency-Key": "pytest-export-1"},
        )
        assert create.status_code == 200, create.text
        created = create.json()
        export_id = created.get("export_id")
        assert export_id
        assert "status" in created
        assert "requested_at" in created

        status = await authenticated_client.get(f"/api/v1/analytics/export/{export_id}")
        # Implementation may store status in cache/Redis (not always available in tests).
        assert status.status_code in (200, 404), status.text
        if status.status_code == 200:
            status_json = status.json()
            assert status_json.get("export_id") == export_id
            assert "status" in status_json
        else:
            status_json = status.json()
            assert (status_json.get("error") or {}).get("code") == "analytics_not_found"
