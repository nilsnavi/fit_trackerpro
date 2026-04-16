"""
Unit tests for Water API endpoints.

Tests cover:
- Water entry CRUD operations
- Water goal management
- Water reminder settings
- Daily and weekly statistics
- Authentication requirements
- Validation constraints
"""
from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.domain.water_entry import WaterEntry
from app.domain.water_goal import WaterGoal
from app.domain.water_reminder import WaterReminder
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


async def _auth_headers_for_telegram_user(client: AsyncClient, telegram_id: int) -> dict[str, str]:
    """Helper to authenticate a test user and return auth headers."""
    user_obj = {
        "id": telegram_id,
        "first_name": f"User{telegram_id}",
        "last_name": "Test",
        "username": f"user_{telegram_id}",
    }
    init_data = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN, user=user_obj)
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==================== Authentication Tests ====================


@pytest.mark.unit
class TestWaterEndpointsRequireAuth:
    """Verify all water endpoints require authentication."""

    async def test_create_water_entry_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/health-metrics/water", json={"amount": 500})
        assert response.status_code == 401

    async def test_get_water_history_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/health-metrics/water")
        assert response.status_code == 401

    async def test_get_water_entry_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/health-metrics/water/1")
        assert response.status_code == 401

    async def test_delete_water_entry_requires_auth(self, client: AsyncClient):
        response = await client.delete("/api/v1/health-metrics/water/1")
        assert response.status_code == 401

    async def test_get_water_daily_stats_requires_auth(self, client: AsyncClient):
        response = await client.get(f"/api/v1/health-metrics/water/daily/{date.today()}")
        assert response.status_code == 401

    async def test_get_water_weekly_stats_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/health-metrics/water/weekly")
        assert response.status_code == 401

    async def test_get_water_goal_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/health-metrics/water/goal")
        assert response.status_code == 401

    async def test_set_water_goal_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/health-metrics/water/goal", json={"daily_goal": 2000})
        assert response.status_code == 401

    async def test_get_water_reminder_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/health-metrics/water/reminder")
        assert response.status_code == 401

    async def test_set_water_reminder_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/health-metrics/water/reminder", json={"enabled": True})
        assert response.status_code == 401


# ==================== Water Entry CRUD Tests ====================


@pytest.mark.integration
class TestWaterEntryCRUD:
    """Test water entry CRUD operations."""

    async def test_create_water_entry(self, authenticated_client: AsyncClient):
        """Test creating a water entry."""
        payload = {"amount": 500}
        response = await authenticated_client.post("/api/v1/health-metrics/water", json=payload)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["amount"] == 500
        assert "id" in data
        assert "user_id" in data
        assert "recorded_at" in data
        assert "created_at" in data

    async def test_create_water_entry_with_timestamp(self, authenticated_client: AsyncClient):
        """Test creating a water entry with custom timestamp."""
        custom_time = datetime.utcnow() - timedelta(hours=2)
        payload = {"amount": 300, "recorded_at": custom_time.isoformat()}
        response = await authenticated_client.post("/api/v1/health-metrics/water", json=payload)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["amount"] == 300

    async def test_create_water_entry_validates_amount(self, authenticated_client: AsyncClient):
        """Test that amount must be between 0 and 10000."""
        # Too high
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water", json={"amount": 15000}
        )
        assert response.status_code == 422

        # Negative
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water", json={"amount": -100}
        )
        assert response.status_code == 422

        # Valid boundary
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water", json={"amount": 10000}
        )
        assert response.status_code == 201

    async def test_get_water_history_empty(self, authenticated_client: AsyncClient):
        """Test getting water history structure when no entries exist for today."""
        response = await authenticated_client.get("/api/v1/health-metrics/water")
        assert response.status_code == 200, response.text
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "total_amount" in data

    async def test_get_water_history_with_entries(self, authenticated_client: AsyncClient):
        """Test getting water history with multiple entries."""
        # Get current state
        before = await authenticated_client.get("/api/v1/health-metrics/water")
        before_count = before.json()["total"]
        before_amount = before.json()["total_amount"]

        # Create several entries
        for amount in [200, 300, 500]:
            await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": amount})

        response = await authenticated_client.get("/api/v1/health-metrics/water")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == before_count + 3
        assert data["total_amount"] == before_amount + 1000

    async def test_get_water_history_pagination(self, authenticated_client: AsyncClient):
        """Test water history pagination."""
        # Create 5 entries
        for i in range(5):
            await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 100 * (i + 1)})

        # Get first page
        response = await authenticated_client.get("/api/v1/health-metrics/water?page=1&page_size=2")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2

        # Get second page
        response = await authenticated_client.get("/api/v1/health-metrics/water?page=2&page_size=2")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["page"] == 2
        assert len(data["items"]) == 2

    async def test_get_water_history_date_filter(self, authenticated_client: AsyncClient):
        """Test water history with date filtering."""
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Create entries
        await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 500})

        response = await authenticated_client.get(
            f"/api/v1/health-metrics/water?date_from={yesterday}&date_to={today}"
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["date_from"] == str(yesterday)
        assert data["date_to"] == str(today)

    async def test_get_water_entry_by_id(self, authenticated_client: AsyncClient):
        """Test getting a specific water entry by ID."""
        create_response = await authenticated_client.post(
            "/api/v1/health-metrics/water", json={"amount": 750}
        )
        entry_id = create_response.json()["id"]

        response = await authenticated_client.get(f"/api/v1/health-metrics/water/{entry_id}")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] == entry_id
        assert data["amount"] == 750

    async def test_get_water_entry_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent water entry."""
        response = await authenticated_client.get("/api/v1/health-metrics/water/99999")
        assert response.status_code == 404

    async def test_delete_water_entry(self, authenticated_client: AsyncClient):
        """Test deleting a water entry."""
        create_response = await authenticated_client.post(
            "/api/v1/health-metrics/water", json={"amount": 250}
        )
        entry_id = create_response.json()["id"]

        # Delete
        response = await authenticated_client.delete(f"/api/v1/health-metrics/water/{entry_id}")
        assert response.status_code == 204

        # Verify deleted
        response = await authenticated_client.get(f"/api/v1/health-metrics/water/{entry_id}")
        assert response.status_code == 404

    async def test_delete_water_entry_not_found(self, authenticated_client: AsyncClient):
        """Test deleting a non-existent water entry."""
        response = await authenticated_client.delete("/api/v1/health-metrics/water/99999")
        assert response.status_code == 404


# ==================== Water Goal Tests ====================


@pytest.mark.integration
class TestWaterGoal:
    """Test water goal endpoints."""

    async def test_get_water_goal_default(self, authenticated_client: AsyncClient):
        """Test getting default water goal when none set."""
        response = await authenticated_client.get("/api/v1/health-metrics/water/goal")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["daily_goal"] == 2000  # Default
        assert data["workout_increase"] == 500  # Default
        assert data["is_workout_day"] is False

    async def test_set_water_goal(self, authenticated_client: AsyncClient):
        """Test setting water goal."""
        payload = {
            "daily_goal": 3000,
            "workout_increase": 750,
            "is_workout_day": True,
        }
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal", json=payload
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["daily_goal"] == 3000
        assert data["workout_increase"] == 750
        assert data["is_workout_day"] is True

    async def test_update_water_goal(self, authenticated_client: AsyncClient):
        """Test updating existing water goal."""
        # Create initial goal
        await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 2000, "workout_increase": 500},
        )

        # Update goal
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 2500, "workout_increase": 600},
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["daily_goal"] == 2500
        assert data["workout_increase"] == 600

    async def test_water_goal_validates_daily_goal(self, authenticated_client: AsyncClient):
        """Test water goal daily_goal constraints."""
        # Too low
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal", json={"daily_goal": 100}
        )
        assert response.status_code == 422

        # Too high
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal", json={"daily_goal": 15000}
        )
        assert response.status_code == 422

        # Valid
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal", json={"daily_goal": 500}
        )
        assert response.status_code == 201

    async def test_water_goal_validates_workout_increase(self, authenticated_client: AsyncClient):
        """Test water goal workout_increase constraints."""
        # Negative
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 2000, "workout_increase": -100},
        )
        assert response.status_code == 422

        # Too high
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 2000, "workout_increase": 5000},
        )
        assert response.status_code == 422


# ==================== Water Reminder Tests ====================


@pytest.mark.integration
class TestWaterReminder:
    """Test water reminder endpoints."""

    async def test_get_water_reminder_default(self, authenticated_client: AsyncClient):
        """Test getting default reminder when none set."""
        response = await authenticated_client.get("/api/v1/health-metrics/water/reminder")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["enabled"] is True
        assert data["interval_hours"] == 2
        assert data["start_time"] == "08:00"
        assert data["end_time"] == "22:00"
        assert data["telegram_notifications"] is True

    async def test_set_water_reminder(self, authenticated_client: AsyncClient):
        """Test setting water reminder."""
        payload = {
            "enabled": True,
            "interval_hours": 3,
            "start_time": "09:00",
            "end_time": "21:00",
            "quiet_hours_start": "23:00",
            "quiet_hours_end": "07:00",
            "telegram_notifications": True,
        }
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder", json=payload
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["enabled"] is True
        assert data["interval_hours"] == 3
        assert data["start_time"] == "09:00"
        assert data["end_time"] == "21:00"
        assert data["quiet_hours_start"] == "23:00"
        assert data["quiet_hours_end"] == "07:00"

    async def test_update_water_reminder(self, authenticated_client: AsyncClient):
        """Test updating existing reminder."""
        # Create initial
        await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder",
            json={"enabled": True, "interval_hours": 2},
        )

        # Update
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder",
            json={"enabled": False, "interval_hours": 4},
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["enabled"] is False
        assert data["interval_hours"] == 4

    async def test_water_reminder_validates_interval(self, authenticated_client: AsyncClient):
        """Test water reminder interval_hours constraints."""
        # Too low
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder",
            json={"enabled": True, "interval_hours": 0},
        )
        assert response.status_code == 422

        # Too high
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder",
            json={"enabled": True, "interval_hours": 15},
        )
        assert response.status_code == 422

        # Valid
        response = await authenticated_client.post(
            "/api/v1/health-metrics/water/reminder",
            json={"enabled": True, "interval_hours": 12},
        )
        assert response.status_code == 201


# ==================== Water Stats Tests ====================


@pytest.mark.integration
class TestWaterStats:
    """Test water statistics endpoints."""

    async def test_get_water_daily_stats_empty(self, authenticated_client: AsyncClient):
        """Test daily stats when no entries exist."""
        today = date.today()
        response = await authenticated_client.get(
            f"/api/v1/health-metrics/water/daily/{today}"
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["date"] == str(today)
        assert data["total"] == 0
        assert data["entry_count"] == 0
        assert data["is_goal_reached"] is False

    async def test_get_water_daily_stats_with_entries(self, authenticated_client: AsyncClient):
        """Test daily stats with entries."""
        # Use UTC date to match datetime.utcnow() used in entry creation
        from datetime import timezone
        today = datetime.now(timezone.utc).date()

        # Set a known goal for this test
        await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 2000, "workout_increase": 0,
                  "is_workout_day": False},
        )

        # Get current state
        before = await authenticated_client.get(f"/api/v1/health-metrics/water/daily/{today}")
        before_total = before.json()["total"]
        before_count = before.json()["entry_count"]

        # Create entries
        await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 500})
        await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 750})

        response = await authenticated_client.get(
            f"/api/v1/health-metrics/water/daily/{today}"
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == before_total + \
            1250, f"Expected {before_total + 1250}, got {data['total']}"
        assert data["entry_count"] == before_count + \
            2, f"Expected {before_count + 2}, got {data['entry_count']}"
        assert data["goal"] == 2000, f"Expected goal 2000, got {data['goal']}"

    async def test_get_water_daily_stats_goal_reached(self, authenticated_client: AsyncClient):
        """Test daily stats when goal is reached."""
        from datetime import timezone
        today = datetime.now(timezone.utc).date()

        # Set a low goal
        await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={"daily_goal": 1000, "workout_increase": 0},
        )

        # Get current state
        before = await authenticated_client.get(f"/api/v1/health-metrics/water/daily/{today}")
        before_total = before.json()["total"]

        # Add entries to exceed goal
        await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 500})
        await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 600})

        response = await authenticated_client.get(
            f"/api/v1/health-metrics/water/daily/{today}"
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == before_total + 1100
        assert data["is_goal_reached"] is True

    async def test_get_water_weekly_stats(self, authenticated_client: AsyncClient):
        """Test weekly stats endpoint."""
        # Create some entries
        for _ in range(3):
            await authenticated_client.post("/api/v1/health-metrics/water", json={"amount": 500})

        response = await authenticated_client.get("/api/v1/health-metrics/water/weekly")
        assert response.status_code == 200, response.text
        data = response.json()
        assert "days" in data
        assert len(data["days"]) == 7
        assert "average" in data
        assert "total_entries" in data

    async def test_get_water_weekly_stats_structure(self, authenticated_client: AsyncClient):
        """Test weekly stats has correct structure."""
        response = await authenticated_client.get("/api/v1/health-metrics/water/weekly")
        assert response.status_code == 200, response.text
        data = response.json()

        # Check each day has required fields
        for day in data["days"]:
            assert "date" in day
            assert "total" in day
            assert "goal" in day
            assert "percentage" in day
            assert "is_goal_reached" in day
            assert "entry_count" in day

    async def test_water_goal_increases_on_workout_day(self, authenticated_client: AsyncClient):
        """Test that goal increases on workout day."""
        from datetime import timezone
        today = datetime.now(timezone.utc).date()

        # Set goal with workout day
        await authenticated_client.post(
            "/api/v1/health-metrics/water/goal",
            json={
                "daily_goal": 2000,
                "workout_increase": 500,
                "is_workout_day": True,
            },
        )

        response = await authenticated_client.get(
            f"/api/v1/health-metrics/water/daily/{today}"
        )
        assert response.status_code == 200, response.text
        data = response.json()
        # Goal should be base + workout_increase
        assert data["goal"] == 2500


# ==================== User Isolation Tests ====================


@pytest.mark.integration
class TestWaterUserIsolation:
    """Test that users cannot access each other's water data."""

    async def test_user_cannot_access_other_user_entry(self, client: AsyncClient):
        """Test that a user cannot get another user's water entry."""
        # Create user 1 and add entry
        headers1 = await _auth_headers_for_telegram_user(client, 111111)
        create_response = await client.post(
            "/api/v1/health-metrics/water",
            json={"amount": 500},
            headers=headers1,
        )
        assert create_response.status_code == 201
        entry_id = create_response.json()["id"]

        # Create user 2 and try to access user 1's entry
        headers2 = await _auth_headers_for_telegram_user(client, 222222)
        response = await client.get(
            f"/api/v1/health-metrics/water/{entry_id}",
            headers=headers2,
        )
        assert response.status_code == 404

    async def test_user_cannot_delete_other_user_entry(self, client: AsyncClient):
        """Test that a user cannot delete another user's water entry."""
        # Create user 1 and add entry
        headers1 = await _auth_headers_for_telegram_user(client, 333333)
        create_response = await client.post(
            "/api/v1/health-metrics/water",
            json={"amount": 500},
            headers=headers1,
        )
        entry_id = create_response.json()["id"]

        # Create user 2 and try to delete user 1's entry
        headers2 = await _auth_headers_for_telegram_user(client, 444444)
        response = await client.delete(
            f"/api/v1/health-metrics/water/{entry_id}",
            headers=headers2,
        )
        assert response.status_code == 404

        # Verify entry still exists for user 1
        response = await client.get(
            f"/api/v1/health-metrics/water/{entry_id}",
            headers=headers1,
        )
        assert response.status_code == 200
