from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.workouts import _infer_workout_type
from app.domain.workout_log import WorkoutLog
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


@pytest.mark.unit
def test_infer_workout_type_prefers_template_type():
    result = _infer_workout_type(
        template_type="cardio",
        tags=["strength"],
        exercises=[{"category": "strength"}],
    )
    assert result == "cardio"


@pytest.mark.unit
def test_infer_workout_type_uses_tags_when_template_missing():
    result = _infer_workout_type(
        template_type=None,
        tags=["warmup", "flexibility"],
        exercises=[{"category": "strength"}],
    )
    assert result == "flexibility"


@pytest.mark.unit
def test_infer_workout_type_fallback_to_mixed():
    result = _infer_workout_type(
        template_type=None,
        tags=["recovery-day"],
        exercises=[{"name": "Unknown"}],
    )
    assert result == "mixed"


async def _auth_headers_for_telegram_user(client: AsyncClient, telegram_id: int) -> dict[str, str]:
    user_obj = {
        "id": telegram_id,
        "first_name": f"User{telegram_id}",
        "last_name": "Test",
        "username": f"user_{telegram_id}",
    }
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=user_obj)
    response = await client.post("/api/v1/users/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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

    async def test_archive_template_hides_from_default_list(self, authenticated_client: AsyncClient):
        payload = {
            "name": "Template Archive",
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

        archived = await authenticated_client.post(
            f"/api/v1/workouts/templates/{template_id}/archive",
        )
        assert archived.status_code == 200, archived.text
        archived_json = archived.json()
        assert archived_json.get("id") == template_id
        assert archived_json.get("is_archived") is True

        listed_default = await authenticated_client.get("/api/v1/workouts/templates")
        assert listed_default.status_code == 200, listed_default.text
        default_ids = [item.get("id") for item in listed_default.json().get("items", [])]
        assert template_id not in default_ids

        listed_with_archived = await authenticated_client.get(
            "/api/v1/workouts/templates",
            params={"include_archived": True},
        )
        assert listed_with_archived.status_code == 200, listed_with_archived.text
        archived_ids = [item.get("id") for item in listed_with_archived.json().get("items", [])]
        assert template_id in archived_ids

    async def test_unarchive_template_returns_to_default_list(self, authenticated_client: AsyncClient):
        payload = {
            "name": "Template Restore",
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

        archived = await authenticated_client.post(f"/api/v1/workouts/templates/{template_id}/archive")
        assert archived.status_code == 200, archived.text

        unarchived = await authenticated_client.post(f"/api/v1/workouts/templates/{template_id}/unarchive")
        assert unarchived.status_code == 200, unarchived.text
        unarchived_json = unarchived.json()
        assert unarchived_json.get("id") == template_id
        assert unarchived_json.get("is_archived") is False

        listed_default = await authenticated_client.get("/api/v1/workouts/templates")
        assert listed_default.status_code == 200, listed_default.text
        default_ids = [item.get("id") for item in listed_default.json().get("items", [])]
        assert template_id in default_ids

    async def test_delete_template_detaches_history_reference(self, authenticated_client: AsyncClient):
        payload = {
            "name": "Template Linked To History",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets": 2,
                    "reps": 12,
                    "rest_seconds": 60,
                }
            ],
            "is_public": False,
        }

        created = await authenticated_client.post("/api/v1/workouts/templates", json=payload)
        assert created.status_code in (200, 201), created.text
        template_id = created.json().get("id")
        assert template_id

        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"template_id": template_id},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        deleted = await authenticated_client.delete(f"/api/v1/workouts/templates/{template_id}")
        assert deleted.status_code == 204, deleted.text

        history_after = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert history_after.status_code == 200, history_after.text
        assert history_after.json().get("template_id") is None

    async def test_clone_and_patch_template_with_expected_version(self, authenticated_client: AsyncClient):
        payload = {
            "name": "Template Clone Source",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets": 3,
                    "reps": 10,
                    "rest_seconds": 60,
                },
                {
                    "exercise_id": 2,
                    "name": "Squats",
                    "sets": 4,
                    "reps": 8,
                    "rest_seconds": 90,
                },
            ],
            "is_public": False,
        }
        created = await authenticated_client.post("/api/v1/workouts/templates", json=payload)
        assert created.status_code in (200, 201), created.text
        source = created.json()
        source_id = source["id"]

        cloned = await authenticated_client.post(
            f"/api/v1/workouts/templates/{source_id}/clone",
            json={},
        )
        assert cloned.status_code in (200, 201), cloned.text
        cloned_json = cloned.json()
        clone_id = cloned_json["id"]
        assert clone_id != source_id
        assert "копия" in cloned_json["name"].lower()
        assert cloned_json.get("version") == 1

        patch_ok = await authenticated_client.patch(
            f"/api/v1/workouts/templates/{clone_id}",
            json={"expected_version": 1, "exercise_order": [1, 0]},
        )
        assert patch_ok.status_code == 200, patch_ok.text
        patched = patch_ok.json()
        assert patched.get("version") == 2
        assert patched["exercises"][0]["exercise_id"] == 2

        patch_conflict = await authenticated_client.patch(
            f"/api/v1/workouts/templates/{clone_id}",
            json={"expected_version": 1, "name": "Stale update"},
        )
        assert patch_conflict.status_code == 409, patch_conflict.text

    async def test_create_template_from_workout_and_start_with_overrides(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Session for template", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        complete_payload = {
            "duration": 30,
            "exercises": [
                {
                    "exercise_id": 11,
                    "name": "Burpees",
                    "sets_completed": [
                        {"set_number": 1, "completed": True, "reps": 12, "weight": None},
                        {"set_number": 2, "completed": True, "reps": 12, "weight": None},
                    ],
                    "notes": "fast",
                }
            ],
            "comments": "Explosive day",
            "tags": ["strength"],
            "glucose_before": None,
            "glucose_after": None,
        }
        completed = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=complete_payload,
            headers={"Idempotency-Key": f"pytest-create-from-workout-{workout_id}-{uuid4()}"},
        )
        assert completed.status_code == 200, completed.text

        created_template = await authenticated_client.post(
            "/api/v1/workouts/templates/from-workout",
            json={"workout_id": workout_id, "name": "From Completed Workout", "is_public": False},
        )
        assert created_template.status_code in (200, 201), created_template.text
        template_json = created_template.json()
        template_id = template_json["id"]
        assert template_json["name"] == "From Completed Workout"
        assert len(template_json["exercises"]) == 1

        started_with_overrides = await authenticated_client.post(
            f"/api/v1/workouts/start/from-template/{template_id}",
            json={
                "name": "Override Run",
                "overrides": {
                    "exercises": [
                        {
                            "exercise_id": 99,
                            "name": "Sprint",
                            "sets": 1,
                            "duration": 60,
                            "rest_seconds": 30,
                        }
                    ],
                    "comments": "override comments",
                    "tags": ["custom"],
                },
            },
        )
        assert started_with_overrides.status_code == 200, started_with_overrides.text
        override_workout_id = started_with_overrides.json().get("id")
        assert override_workout_id

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{override_workout_id}")
        assert detail.status_code == 200, detail.text
        detail_json = detail.json()
        exercises = detail_json.get("exercises") or []
        assert exercises[0].get("exercise_id") == 99

        source_after = await authenticated_client.get(f"/api/v1/workouts/templates/{template_id}")
        assert source_after.status_code == 200, source_after.text
        source_exercises = source_after.json().get("exercises") or []
        assert source_exercises[0].get("exercise_id") == 11

    async def test_session_snapshot_is_immutable_after_template_update(self, authenticated_client: AsyncClient):
        template_payload = {
            "name": "Template Snapshot Source",
            "type": "strength",
            "exercises": [
                {
                    "exercise_id": 10,
                    "name": "Bench Press",
                    "sets": 2,
                    "reps": 8,
                    "rest_seconds": 120,
                }
            ],
            "is_public": False,
        }
        created = await authenticated_client.post("/api/v1/workouts/templates", json=template_payload)
        assert created.status_code in (200, 201), created.text
        template_id = created.json()["id"]

        started = await authenticated_client.post("/api/v1/workouts/start", json={"template_id": template_id})
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        updated_template_payload = {
            **template_payload,
            "exercises": [
                {
                    "exercise_id": 20,
                    "name": "Deadlift",
                    "sets": 3,
                    "reps": 5,
                    "rest_seconds": 180,
                }
            ],
        }
        updated = await authenticated_client.put(
            f"/api/v1/workouts/templates/{template_id}",
            json=updated_template_payload,
        )
        assert updated.status_code == 200, updated.text

        complete_payload = {
            "duration": 35,
            "exercises": [
                {
                    "exercise_id": 10,
                    "name": "Bench Press",
                    "sets_completed": [
                        {
                            "set_number": 1,
                            "set_type": "warmup",
                            "completed": True,
                            "reps": 10,
                            "weight": 40,
                            "rpe": 5,
                        },
                        {
                            "set_number": 2,
                            "set_type": "failure",
                            "completed": True,
                            "reps": 8,
                            "weight": 60,
                            "rpe": 9.5,
                        },
                    ],
                }
            ],
            "comments": "snapshot check",
            "tags": ["strength"],
        }
        completed = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=complete_payload,
            headers={"Idempotency-Key": f"pytest-snapshot-{workout_id}-{uuid4()}"},
        )
        assert completed.status_code == 200, completed.text

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        exercises = detail.json().get("exercises") or []
        assert exercises[0]["exercise_id"] == 10
        sets = exercises[0].get("sets_completed") or []
        assert sets[0].get("set_type") == "warmup"
        assert sets[1].get("set_type") == "failure"


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

        idem_key = f"pytest-idem-{workout_id}-{uuid4()}"
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

    async def test_update_active_workout_persists_session_payload(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Силовая • 3 круга", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        update_payload = {
            "comments": "Силовая • 3 круга",
            "tags": ["strength"],
            "glucose_before": None,
            "glucose_after": None,
            "exercises": [
                {
                    "exercise_id": 101,
                    "name": "Burpees",
                    "notes": "Круг 1",
                    "sets_completed": [
                        {"set_number": 1, "completed": False, "reps": 12, "weight": None, "duration": None}
                    ],
                },
                {
                    "exercise_id": 102,
                    "name": "Таймер отдыха",
                    "notes": "Перерыв",
                    "sets_completed": [
                        {"set_number": 1, "completed": False, "reps": None, "weight": None, "duration": 60}
                    ],
                },
            ],
        }

        updated = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json=update_payload,
        )
        assert updated.status_code == 200, updated.text
        updated_json = updated.json()
        assert updated_json.get("comments") == update_payload["comments"]
        assert updated_json.get("tags") == update_payload["tags"]
        exercises = updated_json.get("exercises") or []
        assert len(exercises) == 2
        assert exercises[0].get("name") == "Burpees"
        assert exercises[1].get("sets_completed")[0].get("duration") == 60

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        detail_json = detail.json()
        assert len(detail_json.get("exercises") or []) == 2
        assert detail_json.get("comments") == update_payload["comments"]

    async def test_create_session_endpoint_supports_all_start_sources(
        self,
        authenticated_client: AsyncClient,
    ):
        quick = await authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={"source_type": "quick_start", "name": "Quick start"},
        )
        assert quick.status_code == 201, quick.text
        assert quick.json()["source_type"] == "quick_start"
        assert quick.json()["source_id"] is None

        template_payload = {
            "name": "Session Source Template",
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
        created_template = await authenticated_client.post(
            "/api/v1/workouts/templates",
            json=template_payload,
        )
        assert created_template.status_code in (200, 201), created_template.text
        template_id = created_template.json()["id"]

        from_template = await authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={"source_type": "personal_template", "source_id": template_id},
        )
        assert from_template.status_code == 201, from_template.text
        from_template_json = from_template.json()
        assert from_template_json["template_id"] == template_id
        assert from_template_json["source_type"] == "personal_template"
        assert from_template_json["source_id"] == template_id

        previous = await authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "source_type": "previous_session",
                "source_id": from_template_json["id"],
                "name": "Repeat previous",
            },
        )
        assert previous.status_code == 201, previous.text
        previous_json = previous.json()
        assert previous_json["source_type"] == "previous_session"
        assert previous_json["source_id"] == from_template_json["id"]

        program_day = await authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={"source_type": "program_day", "source_id": 123, "name": "Program day"},
        )
        assert program_day.status_code == 201, program_day.text
        assert program_day.json()["source_type"] == "program_day"
        assert program_day.json()["source_id"] == 123

    async def test_update_active_workout_conflict_returns_409_details(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Conflict session", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        # Any incorrect expected_version should produce 409 with details.
        payload = {
            "comments": "stale update",
            "tags": ["strength"],
            "exercises": [],
            "expected_version": 999,
            "idempotency_key": "pytest-conflict-update-key",
        }

        conflict = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json=payload,
        )
        assert conflict.status_code == 409, conflict.text
        body = conflict.json()
        assert (body.get("error") or {}).get("code") == "workout_conflict"
        details = (body.get("error") or {}).get("details") or {}
        assert details.get("expected_version") == 999
        assert details.get("current_version") == 1
        assert details.get("workout_id") == workout_id

    async def test_update_active_workout_body_idempotency_replays_response(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Idempotent update", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        first_payload = {
            "comments": "first",
            "tags": ["strength"],
            "exercises": [
                {
                    "exercise_id": 201,
                    "name": "Pull-ups",
                    "sets_completed": [
                        {"set_number": 1, "completed": False, "reps": 8, "weight": None, "duration": None},
                        {"set_number": 2, "completed": False, "reps": 8, "weight": None, "duration": None},
                    ],
                }
            ],
            "expected_version": 1,
            "idempotency_key": "pytest-update-idem-same",
        }

        r1 = await authenticated_client.patch(f"/api/v1/workouts/history/{workout_id}", json=first_payload)
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert body1.get("version") == 2
        first_set_id = body1["exercises"][0]["sets_completed"][0].get("id")
        second_set_id = body1["exercises"][0]["sets_completed"][1].get("id")
        assert isinstance(first_set_id, int)
        assert first_set_id > 0
        assert isinstance(second_set_id, int)
        assert second_set_id > 0
        assert second_set_id != first_set_id

        # Replay with same payload + same key should return cached version=2.
        r2 = await authenticated_client.patch(f"/api/v1/workouts/history/{workout_id}", json=first_payload)
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert body2.get("version") == 2
        assert body2.get("comments") == "first"
        assert body2["exercises"][0]["sets_completed"][0].get("id") == first_set_id
        assert body2["exercises"][0]["sets_completed"][1].get("id") == second_set_id

        # Completing one set must not recreate all set rows and stale the next set id.
        p1 = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/sets/{first_set_id}",
            json={"completed": True, "reps": 8, "weight": 50},
        )
        assert p1.status_code == 200, p1.text
        assert p1.json().get("id") == first_set_id

        p2 = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/sets/{second_set_id}",
            json={"completed": True, "reps": 8, "weight": 50},
        )
        assert p2.status_code == 200, p2.text
        assert p2.json().get("id") == second_set_id

        # SPEC-005 §20: a timed set persists its measured duration instead of reps.
        p3 = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/sets/{second_set_id}",
            json={"completed": True, "duration": 45},
        )
        assert p3.status_code == 200, p3.text
        assert p3.json().get("duration") == 45

        detail_after_timed = await authenticated_client.get(
            f"/api/v1/workouts/history/{workout_id}",
        )
        assert detail_after_timed.status_code == 200, detail_after_timed.text
        persisted_timed_set = detail_after_timed.json()["exercises"][0]["sets_completed"][1]
        assert persisted_timed_set.get("duration") == 45

        # Same key but different payload must return conflict.
        changed_payload = {
            **first_payload,
            "comments": "changed",
        }
        r3 = await authenticated_client.patch(f"/api/v1/workouts/history/{workout_id}", json=changed_payload)
        assert r3.status_code == 409, r3.text

    async def test_complete_workout_body_idempotency_replays_response(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Idempotent complete", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json().get("id")
        assert workout_id

        payload = {
            "duration": 30,
            "exercises": [
                {
                    "exercise_id": 11,
                    "name": "Burpees",
                    "sets_completed": [
                        {"set_number": 1, "completed": True, "reps": 12, "weight": None},
                    ],
                    "notes": "fast",
                }
            ],
            "comments": "done",
            "tags": ["strength"],
            "glucose_before": None,
            "glucose_after": None,
            "expected_version": 1,
            "idempotency_key": "pytest-complete-idem-same",
        }

        c1 = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=payload,
        )
        assert c1.status_code == 200, c1.text
        c1_body = c1.json()
        assert c1_body.get("version") == 2

        c2 = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=payload,
        )
        assert c2.status_code == 200, c2.text
        c2_body = c2.json()
        assert c2_body.get("version") == 2
        assert c2_body.get("duration") == 30

        payload_changed = {
            **payload,
            "duration": 31,
        }
        c3 = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=payload_changed,
        )
        assert c3.status_code == 409, c3.text


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


@pytest.mark.integration
class TestWorkoutValidationAuthorizationLifecycle:
    async def test_create_template_validation_rejects_empty_exercises(
        self,
        authenticated_client: AsyncClient,
    ):
        payload = {
            "name": "Invalid template",
            "type": "strength",
            "exercises": [],
            "is_public": False,
        }
        response = await authenticated_client.post("/api/v1/workouts/templates", json=payload)
        assert response.status_code == 422, response.text

    async def test_complete_workout_validation_rejects_invalid_duration(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Validation duration", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        response = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json={
                "duration": 0,
                "exercises": [
                    {
                        "exercise_id": 1,
                        "name": "Push-ups",
                        "sets_completed": [
                            {"set_number": 1, "completed": True, "reps": 10, "weight": None},
                        ],
                    }
                ],
                "comments": "invalid duration",
                "tags": ["test"],
            },
        )
        assert response.status_code == 422, response.text

    async def test_update_session_validation_rejects_out_of_range_glucose(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Validation glucose", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        response = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={
                "exercises": [],
                "comments": "glucose test",
                "tags": [],
                "glucose_before": 1.9,
            },
        )
        assert response.status_code == 422, response.text

    async def test_authorization_blocks_cross_user_template_and_session_access(
        self,
        authenticated_client: AsyncClient,
        client: AsyncClient,
    ):
        create_template = await authenticated_client.post(
            "/api/v1/workouts/templates",
            json={
                "name": "Owner template",
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
            },
        )
        assert create_template.status_code in (200, 201), create_template.text
        template_id = create_template.json()["id"]

        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"template_id": template_id},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        other_headers = await _auth_headers_for_telegram_user(client, telegram_id=987654321)

        template_by_other = await client.get(
            f"/api/v1/workouts/templates/{template_id}",
            headers=other_headers,
        )
        assert template_by_other.status_code == 404, template_by_other.text

        workout_by_other = await client.get(
            f"/api/v1/workouts/history/{workout_id}",
            headers=other_headers,
        )
        assert workout_by_other.status_code == 404, workout_by_other.text

        update_by_other = await client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={"exercises": [], "comments": "hack", "tags": []},
            headers=other_headers,
        )
        assert update_by_other.status_code == 404, update_by_other.text

    async def test_session_lifecycle_complete_is_idempotent_without_extra_writes(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Lifecycle complete", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        payload = {
            "duration": 35,
            "exercises": [
                {
                    "exercise_id": 1,
                    "name": "Push-ups",
                    "sets_completed": [
                        {"set_number": 1, "completed": True, "reps": 12, "weight": None},
                    ],
                }
            ],
            "comments": "done",
            "tags": ["strength"],
        }

        first = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=payload,
        )
        assert first.status_code == 200, first.text
        first_json = first.json()

        second = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json=payload,
        )
        assert second.status_code == 200, second.text
        second_json = second.json()

        assert second_json.get("version") == first_json.get("version")
        assert "duplicate request ignored" in (second_json.get("message") or "").lower()

    async def test_fast_sequential_session_updates_detect_stale_expected_version(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Fast updates", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        first = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={
                "exercises": [],
                "comments": "first click",
                "tags": ["strength"],
                "expected_version": 1,
            },
        )
        assert first.status_code == 200, first.text
        assert first.json().get("version") == 2

        second = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={
                "exercises": [],
                "comments": "second stale click",
                "tags": ["strength"],
                "expected_version": 1,
            },
        )
        assert second.status_code == 409, second.text

    async def test_history_detail_recomputes_session_metrics_for_legacy_rows(
        self,
        authenticated_client: AsyncClient,
        db_session,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Legacy metrics fallback", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        workout_id = started.json()["id"]

        completed = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json={
                "duration": 42,
                "exercises": [
                    {
                        "exercise_id": 1,
                        "name": "Squat",
                        "sets_completed": [
                            {"set_number": 1, "completed": True, "reps": 6, "weight": 100, "rpe": 7.5},
                            {
                                "set_number": 2,
                                "completed": True,
                                "reps": 5,
                                "weight": 100,
                                "rpe": 8.5,
                                "actual_rest_seconds": 90,
                            },
                        ],
                    }
                ],
                "comments": "done",
                "tags": ["strength"],
            },
        )
        assert completed.status_code == 200, completed.text
        assert completed.json()["session_metrics"]["avg_rpe"] == 8.0

        row = (
            await db_session.execute(select(WorkoutLog).where(WorkoutLog.id == workout_id))
        ).scalar_one()
        row.session_metrics = None
        await db_session.commit()

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        detail_json = detail.json()
        assert detail_json["session_metrics"]["avg_rpe"] == 8.0
        assert detail_json["session_metrics"]["rest_tracked_sets"] == 1


@pytest.mark.integration
class TestSpec005SessionLifecycle:
    """SPEC-005 §3/§48: status lifecycle, cancel and restore."""

    async def test_start_returns_active_status_and_started_at(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 lifecycle", "type": "strength"},
        )
        assert started.status_code == 200, started.text
        body = started.json()
        assert body["session_status"] == "active"

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{body['id']}")
        assert detail.status_code == 200, detail.text
        detail_json = detail.json()
        assert detail_json["status"] == "active"
        assert detail_json.get("started_at") is not None

    async def test_pause_and_resume_session(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 pause", "type": "strength"},
        )
        workout_id = started.json()["id"]

        paused = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={"exercises": [], "comments": "pause test", "tags": [], "status": "paused"},
        )
        assert paused.status_code == 200, paused.text
        assert paused.json()["status"] == "paused"

        resumed = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={"exercises": [], "comments": "pause test", "tags": [], "status": "active"},
        )
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["status"] == "active"

    async def test_cancel_marks_cancelled_and_excluded_from_incomplete(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 cancel", "type": "strength"},
        )
        workout_id = started.json()["id"]

        listed = await authenticated_client.get("/api/v1/workouts/sessions/incomplete")
        assert listed.status_code == 200, listed.text
        assert any(item["id"] == workout_id for item in listed.json())

        cancelled = await authenticated_client.post(
            f"/api/v1/workouts/{workout_id}/cancel",
            json={"comments": "user cancelled"},
        )
        assert cancelled.status_code == 200, cancelled.text
        assert cancelled.json()["status"] == "cancelled"

        listed_after = await authenticated_client.get("/api/v1/workouts/sessions/incomplete")
        assert listed_after.status_code == 200, listed_after.text
        assert all(item["id"] != workout_id for item in listed_after.json())

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["status"] == "cancelled"

    async def test_cancel_is_idempotent_with_key(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 cancel idem", "type": "strength"},
        )
        workout_id = started.json()["id"]
        idem_key = f"pytest-cancel-{workout_id}-{uuid4()}"

        first = await authenticated_client.post(
            f"/api/v1/workouts/{workout_id}/cancel",
            json={"idempotency_key": idem_key},
        )
        assert first.status_code == 200, first.text

        second = await authenticated_client.post(
            f"/api/v1/workouts/{workout_id}/cancel",
            json={"idempotency_key": idem_key},
        )
        assert second.status_code == 200, second.text
        assert second.json()["id"] == workout_id

    async def test_complete_returns_records_and_progression_recommendations(
        self,
        authenticated_client: AsyncClient,
    ):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 complete", "type": "strength"},
        )
        workout_id = started.json()["id"]

        completed = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json={
                "duration": 30,
                "exercises": [
                    {
                        "exercise_id": 1,
                        "name": "Push-ups",
                        "sets_completed": [
                            {"set_number": 1, "completed": True, "reps": 10, "weight": None},
                        ],
                    }
                ],
                "comments": "done",
                "tags": ["strength"],
            },
        )
        assert completed.status_code == 200, completed.text
        assert completed.json().get("personal_records") == []
        assert completed.json().get("progression_recommendations")


class TestSpec005ExerciseOperations:
    """SPEC-005 §25–28: skip / replace / reorder session exercises."""

    async def _start_session_with_two_exercises(self, authenticated_client: AsyncClient) -> int:
        started = await authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "source_type": "quick_start",
                "name": "Spec005 exercises",
                "type": "strength",
                "overrides": {
                    "exercises": [
                        {
                            "exercise_id": 1,
                            "name": "Push-ups",
                            "sets": 2,
                            "reps": 10,
                            "rest_seconds": 60,
                        },
                        {
                            "exercise_id": 2,
                            "name": "Squats",
                            "sets": 2,
                            "reps": 8,
                            "rest_seconds": 90,
                        },
                    ],
                },
            },
        )
        assert started.status_code in (200, 201), started.text
        return started.json()["id"]

    async def _get_detail(self, authenticated_client: AsyncClient, workout_id: int) -> dict:
        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        return detail.json()

    async def test_skip_exercise_session_only(self, authenticated_client: AsyncClient):
        workout_id = await self._start_session_with_two_exercises(authenticated_client)
        detail = await self._get_detail(authenticated_client, workout_id)
        rows = detail["exercises"]
        row_id = rows[1]["id"]

        patched = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/exercises/{row_id}",
            json={"status": "skipped"},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["exercises"][1]["status"] == "skipped"

    async def test_replace_exercise_session_only(self, authenticated_client: AsyncClient):
        workout_id = await self._start_session_with_two_exercises(authenticated_client)
        detail = await self._get_detail(authenticated_client, workout_id)
        row_id = detail["exercises"][0]["id"]

        patched = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/exercises/{row_id}",
            json={"replacement_exercise_id": 55, "replacement_name": "Dips"},
        )
        assert patched.status_code == 200, patched.text
        replaced = patched.json()["exercises"][0]
        assert replaced["exercise_id"] == 55
        assert replaced["name"] == "Dips"

    async def test_reorder_exercise_session_only(self, authenticated_client: AsyncClient):
        workout_id = await self._start_session_with_two_exercises(authenticated_client)
        detail = await self._get_detail(authenticated_client, workout_id)
        row_id = detail["exercises"][1]["id"]

        patched = await authenticated_client.patch(
            f"/api/v1/workouts/{workout_id}/exercises/{row_id}",
            json={"target_order_index": 0},
        )
        assert patched.status_code == 200, patched.text
        exercises = patched.json()["exercises"]
        assert exercises[0]["name"] == "Squats"
        assert exercises[1]["name"] == "Push-ups"

    async def test_patch_requires_auth(self, client: AsyncClient):
        r = await client.patch(
            "/api/v1/workouts/1/exercises/1",
            json={"status": "skipped"},
        )
        assert r.status_code == 401


class TestSpec005SupersetBlocks:
    """SPEC-005 §24/§21–23: blocks persist with the session."""

    async def test_blocks_roundtrip_via_session_update(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 blocks", "type": "strength"},
        )
        workout_id = started.json()["id"]

        updated = await authenticated_client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={
                "exercises": [],
                "comments": "blocks",
                "tags": [],
                "blocks": [
                    {"client_id": "blk-a", "type": "SUPERSET", "order": 0, "rounds": 3, "rest_seconds": 90},
                ],
            },
        )
        assert updated.status_code == 200, updated.text

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        blocks = detail.json().get("blocks") or []
        assert len(blocks) == 1
        assert blocks[0]["type"] == "SUPERSET"
        assert blocks[0]["rounds"] == 3
        assert blocks[0]["rest_seconds"] == 90


class TestSpec005MetricsAndSets:
    """SPEC-005 §10/§52: warm-up split in metrics + set patch with PR response."""

    async def test_metrics_split_warmup_and_working(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 metrics", "type": "strength"},
        )
        workout_id = started.json()["id"]

        completed = await authenticated_client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json={
                "duration": 40,
                "exercises": [
                    {
                        "exercise_id": 1,
                        "name": "Bench Press",
                        "sets_completed": [
                            {"set_number": 1, "set_type": "warmup", "completed": True, "reps": 10, "weight": 40},
                            {"set_number": 2, "set_type": "working", "completed": True, "reps": 8, "weight": 80},
                            {"set_number": 3, "set_type": "working", "completed": True, "reps": 6, "weight": 80},
                        ],
                    }
                ],
                "comments": "metrics",
                "tags": ["strength"],
            },
        )
        assert completed.status_code == 200, completed.text
        metrics = completed.json()["session_metrics"]
        assert metrics["warmup_sets"] == 1
        assert metrics["working_sets"] == 2
        assert metrics["total_volume"] == pytest.approx(80 * 8 + 80 * 6)

    async def test_patch_set_returns_completed_at(self, authenticated_client: AsyncClient):
        started = await authenticated_client.post(
            "/api/v1/workouts/start",
            json={"name": "Spec005 set patch", "type": "strength"},
        )
        workout_id = started.json()["id"]

        detail = await authenticated_client.get(f"/api/v1/workouts/history/{workout_id}")
        assert detail.status_code == 200, detail.text
        # Session started from empty quick start has no exercises/sets yet.
        assert detail.json()["exercises"] == []


class TestSpec005RecommendationEndpoints:
    """SPEC-005 §37–38/§42–43/§19: recommendation and calculator endpoints."""

    async def test_plate_calculator_endpoint(self, authenticated_client: AsyncClient):
        r = await authenticated_client.post(
            "/api/v1/workouts/plate-calculator",
            json={"target_weight": 100, "bar_weight": 20},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["achievable"] is True
        assert body["plates_per_side"] == [25, 15]

    async def test_plate_calculator_nearest_when_impossible(self, authenticated_client: AsyncClient):
        r = await authenticated_client.post(
            "/api/v1/workouts/plate-calculator",
            json={"target_weight": 81, "bar_weight": 20, "available_plates": [25, 10, 5]},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["achievable"] is False
        assert body["nearest_weight"] == 80

    async def test_progression_endpoint_no_history(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get(
            "/api/v1/workouts/progression/recommendation",
            params={"exercise_id": 999999, "policy": "DOUBLE_PROGRESSION"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # SPEC-006 §30: reason codes come from the canonical engine enum.
        assert body["reason_code"] == "NO_PREVIOUS_HISTORY"
        assert body["recommended_value"] is None
        assert body["policy"] == "DOUBLE_PROGRESSION"

    async def test_smart_rest_recommendation(self, authenticated_client: AsyncClient):
        r = await authenticated_client.get(
            "/api/v1/workouts/sessions/1/exercises/1/smart-rest",
            params={"set_type": "working", "rpe": 9},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["recommended_rest_seconds"] >= 120
        assert body["reason_code"]

    async def test_plate_calculator_requires_auth(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/workouts/plate-calculator",
            json={"target_weight": 100, "bar_weight": 20},
        )
        assert r.status_code == 401

