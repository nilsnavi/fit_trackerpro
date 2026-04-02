import pytest
from httpx import AsyncClient


@pytest.mark.integration
class TestWorkoutTemplates:
    async def test_create_template_requires_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/workouts/templates", json={})
        assert r.status_code == 401

    async def test_list_templates_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/workouts/templates")
        assert r.status_code == 401

    async def test_template_crud_happy_path(self, authenticated_client: AsyncClient):
        """
        Covers:
        - POST /workouts/templates -> 201
        - GET /workouts/templates -> includes created
        - GET /workouts/templates/{id} -> returns same
        - PUT /workouts/templates/{id} -> updates
        - DELETE /workouts/templates/{id} -> 204
        """
        payload = {
            "name": "Template A",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets": 3,
                    "reps": 10,
                    "rest_seconds": 60,
                }
            ],
            "is_public": False,
        }

        created = await authenticated_client.post("/api/v1/workouts/templates", json=payload)
        assert created.status_code in (200, 201), created.text
        created_json = created.json()
        template_id = created_json.get("id")
        assert template_id, created_json
        assert created_json.get("name") == payload["name"]
        assert created_json.get("type") in (payload["type"], str(payload["type"]))
        assert isinstance(created_json.get("exercises"), list)
        assert created_json.get("is_public") is False

        listed = await authenticated_client.get("/api/v1/workouts/templates")
        assert listed.status_code == 200, listed.text
        listed_json = listed.json()
        assert "items" in listed_json
        items = listed_json["items"]
        assert isinstance(items, list)
        assert any((t or {}).get("id") == template_id for t in items)

        fetched = await authenticated_client.get(f"/api/v1/workouts/templates/{template_id}")
        assert fetched.status_code == 200, fetched.text
        fetched_json = fetched.json()
        assert fetched_json.get("id") == template_id
        assert fetched_json.get("name") == payload["name"]
        assert isinstance(fetched_json.get("exercises"), list)
        assert len(fetched_json["exercises"]) == len(payload["exercises"])

        updated_payload = {**payload, "name": "Template A (updated)"}
        updated = await authenticated_client.put(
            f"/api/v1/workouts/templates/{template_id}",
            json=updated_payload,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json().get("name") == "Template A (updated)"
        assert isinstance(updated.json().get("exercises"), list)

        deleted = await authenticated_client.delete(f"/api/v1/workouts/templates/{template_id}")
        assert deleted.status_code == 204, deleted.text

        after = await authenticated_client.get(f"/api/v1/workouts/templates/{template_id}")
        assert after.status_code in (404, 410), after.text

    async def test_update_template_updates_exercises(self, authenticated_client: AsyncClient):
        """PUT /workouts/templates/{id} should persist updated exercise list."""
        payload = {
            "name": "Template B",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets": 3,
                    "reps": 10,
                    "rest_seconds": 60,
                }
            ],
            "is_public": False,
        }
        created = await authenticated_client.post("/api/v1/workouts/templates", json=payload)
        assert created.status_code in (200, 201), created.text
        template_id = created.json().get("id")
        assert template_id

        updated_payload = {
            **payload,
            "exercises": [
                {
                    "exercise_id": 2,
                    "name": "Squats",
                    "sets": 5,
                    "reps": 5,
                    "rest_seconds": 120,
                }
            ],
        }
        updated = await authenticated_client.put(
            f"/api/v1/workouts/templates/{template_id}",
            json=updated_payload,
        )
        assert updated.status_code == 200, updated.text

        fetched = await authenticated_client.get(f"/api/v1/workouts/templates/{template_id}")
        assert fetched.status_code == 200, fetched.text
        exercises = fetched.json().get("exercises") or []
        assert len(exercises) == 1
        assert exercises[0].get("exercise_id") == 2


@pytest.mark.integration
class TestWorkoutStartComplete:
    async def test_start_requires_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/workouts/start", json={})
        assert r.status_code == 401

    async def test_start_from_template_then_complete_with_idempotency(
        self,
        authenticated_client: AsyncClient,
    ):
        """
        Critical flow:
        - create template
        - start workout from template (draft)
        - complete workout with Idempotency-Key
        - repeating complete with same key must be safe (no double-apply)
        """
        template_payload = {
            "name": "Template for start",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets": 2,
                    "reps": 10,
                    "rest_seconds": 60,
                }
            ],
            "is_public": False,
        }
        created = await authenticated_client.post("/api/v1/workouts/templates", json=template_payload)
        assert created.status_code in (200, 201), created.text
        template_id = created.json().get("id")
        assert template_id

        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"template_id": template_id},
        )
        assert started.status_code == 200, started.text
        started_json = started.json()
        workout_id = started_json.get("id") or started_json.get("workout_id")
        assert workout_id, started_json

        detail_after_start = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail_after_start.status_code == 200, detail_after_start.text
        started_detail = detail_after_start.json()
        started_exercises = started_detail.get("exercises") or []
        assert len(started_exercises) == 1
        assert started_exercises[0].get("exercise_id") == 1
        assert len(started_exercises[0].get("sets_completed") or []) == 2
        assert all(
            set_row.get("completed") is False
            for set_row in (started_exercises[0].get("sets_completed") or [])
        )

        # Minimal completion payload — adjust to the exact schema if needed.
        complete_payload = {
            "duration": 45,
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets_completed": [
                        {"set_number": 1, "completed": True, "reps": 10, "weight": None},
                        {"set_number": 2, "completed": False, "reps": 10, "weight": None},
                    ],
                    "notes": None,
                }
            ],
            "comments": "Good session",
            "tags": ["test"],
            "glucose_before": None,
            "glucose_after": None,
        }

        idem_key = "pytest-idem-1"
        completed_1 = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=complete_payload,
            headers={"Idempotency-Key": idem_key},
        )
        assert completed_1.status_code == 200, completed_1.text
        completed_1_json = completed_1.json()
        assert completed_1_json.get("id") == workout_id
        assert completed_1_json.get("duration") == complete_payload["duration"]
        assert isinstance(completed_1_json.get("exercises"), list)

        completed_2 = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=complete_payload,
            headers={"Idempotency-Key": idem_key},
        )
        assert completed_2.status_code == 200, completed_2.text
        completed_2_json = completed_2.json()
        assert completed_2_json.get("id") == workout_id

        # History/detail should show completed duration > 0
        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        detail_json = detail.json()
        assert detail_json.get("id") == workout_id
        assert detail_json.get("duration") == complete_payload["duration"]
        assert isinstance(detail_json.get("exercises"), list)


@pytest.mark.integration
class TestWorkoutHistory:
    async def test_history_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/workouts/history")
        assert r.status_code == 401

    async def test_history_pagination_contract(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get("/api/v1/workouts/history?page=1&page_size=20")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("items"), list)
        assert data.get("page") == 1
        assert data.get("page_size") == 20
        assert "total" in data

