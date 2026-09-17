"""SPEC-006 integration tests: evaluation after complete, lifecycle, scopes.

These exercise the real HTTP stack + DB (SQLite in-memory locally, PostgreSQL in
CI), so they cover §40 (evaluation trigger), §41–§44 (API + lifecycle), §52
(idempotency) and §55–§57 (the required integration flows).
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.domain.progression_recommendation import ProgressionRecommendationRecord

BENCH_PRESS = 1
SQUAT = 2


def _sets(reps_list, *, weight, set_type="working", rpe=None, rir=None):
    return [
        {
            "set_number": index + 1,
            "set_type": set_type,
            "completed": True,
            "reps": reps,
            "weight": weight,
            "rpe": rpe,
            "rir": rir,
        }
        for index, reps in enumerate(reps_list)
    ]


class ProgressionFlow:
    """Small helper facade over the existing workouts API."""

    def __init__(self, client: AsyncClient) -> None:
        self.client = client

    async def create_template(
        self,
        *,
        name: str = "Bench day",
        exercises: list[dict] | None = None,
    ) -> int:
        payload = {
            "name": name,
            "type": "strength",
            "exercises": exercises
            or [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets": 3,
                    "reps": 12,
                    "weight": 80,
                    "rest_seconds": 120,
                }
            ],
            "is_public": False,
        }
        response = await self.client.post("/api/v1/workouts/templates", json=payload)
        assert response.status_code in (200, 201), response.text
        return int(response.json()["id"])

    async def start(self, template_id: int | None = None) -> int:
        body: dict = {"name": "Bench session", "type": "strength"}
        if template_id is not None:
            body = {"template_id": template_id}
        response = await self.client.post("/api/v1/workouts/start", json=body)
        assert response.status_code in (200, 201), response.text
        return int(response.json()["id"])

    async def repeat(self, source_session_id: int) -> dict:
        """"Повторить тренировку": start a session copied from a finished one."""
        response = await self.client.post(
            "/api/v1/workouts/sessions",
            json={
                "source_type": "previous_session",
                "source_id": source_session_id,
                "name": "Repeat previous",
            },
        )
        assert response.status_code in (200, 201), response.text
        return response.json()

    async def complete(self, workout_id: int, exercises: list[dict]) -> dict:
        response = await self.client.post(
            f"/api/v1/workouts/complete?workout_id={workout_id}",
            json={"duration": 45, "exercises": exercises, "tags": ["strength"]},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def set_policy(self, exercise_id: int, **fields) -> dict:
        response = await self.client.put(
            f"/api/v1/progression/exercises/{exercise_id}",
            params={"template_id": fields.pop("template_id", None)}
            if fields.get("template_id") is not None
            else None,
            json={"type": "DOUBLE_PROGRESSION", **fields},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def get_policy(self, exercise_id: int, **params) -> dict:
        response = await self.client.get(
            f"/api/v1/progression/exercises/{exercise_id}",
            params={key: value for key, value in params.items() if value is not None},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def get_recommendation(self, exercise_id: int, **params) -> dict:
        response = await self.client.get(
            f"/api/v1/progression/exercises/{exercise_id}/recommendation",
            params={key: value for key, value in params.items() if value is not None},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def history(self, exercise_id: int, **params) -> list[dict]:
        response = await self.client.get(
            f"/api/v1/progression/exercises/{exercise_id}/history",
            params={key: value for key, value in params.items() if value is not None},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def accept(self, recommendation_id: int, selected_value: float | None = None):
        body = {} if selected_value is None else {"selected_value": selected_value}
        return await self.client.post(
            f"/api/v1/progression/recommendations/{recommendation_id}/accept", json=body
        )

    async def reject(self, recommendation_id: int):
        return await self.client.post(
            f"/api/v1/progression/recommendations/{recommendation_id}/reject"
        )


@pytest.fixture
def flow(authenticated_client: AsyncClient) -> ProgressionFlow:
    return ProgressionFlow(authenticated_client)


@pytest.mark.integration
class TestProgressionPolicyApi:
    async def test_requires_authentication(self, client: AsyncClient):
        assert (await client.get("/api/v1/progression/exercises/1")).status_code == 401
        assert (
            await client.get("/api/v1/progression/exercises/1/recommendation")
        ).status_code == 401
        assert (
            await client.post("/api/v1/progression/recommendations/1/accept")
        ).status_code == 401

    async def test_default_policy_is_manual(self, flow: ProgressionFlow):
        policy = await flow.get_policy(BENCH_PRESS)
        assert policy["type"] == "MANUAL"
        assert policy["policy_version"] == "MANUAL_V1"
        assert policy["id"] is None
        assert policy["scope_key"] == f"u{policy['user_id']}:e{BENCH_PRESS}"

    async def test_put_policy_persists_and_versions(self, flow: ProgressionFlow):
        policy = await flow.set_policy(
            BENCH_PRESS,
            increment=2.5,
            reps_min=8,
            reps_max=12,
            sets_target=3,
        )
        assert policy["type"] == "DOUBLE_PROGRESSION"
        assert policy["policy_version"] == "DOUBLE_PROGRESSION_V1"
        assert policy["id"] is not None

        again = await flow.get_policy(BENCH_PRESS)
        assert again["id"] == policy["id"]
        assert again["reps_max"] == 12

    async def test_policy_scope_is_isolated_per_template_slot(
        self, flow: ProgressionFlow
    ):
        monday = await flow.create_template(name="Monday 5x5")
        friday = await flow.create_template(name="Friday 3x8-12")

        monday_policy = await flow.set_policy(
            BENCH_PRESS, template_id=monday, increment=2.5, reps_min=8, reps_max=12
        )
        friday_policy = await flow.set_policy(
            BENCH_PRESS, template_id=friday, increment=5, reps_min=3, reps_max=5
        )

        assert monday_policy["scope_key"] != friday_policy["scope_key"]
        assert ":t" in monday_policy["scope_key"]

        refetched_monday = await flow.get_policy(BENCH_PRESS, template_id=monday)
        refetched_friday = await flow.get_policy(BENCH_PRESS, template_id=friday)
        assert refetched_monday["increment"] == 2.5
        assert refetched_friday["increment"] == 5


@pytest.mark.integration
class TestProgressionEvaluation:
    async def test_golden_path_upper_bound_increases_weight(self, flow: ProgressionFlow):
        """SPEC §55/§70: 80x12/12/12 with double progression -> 82.5 kg."""
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)

        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )

        recommendations = completed["progression_recommendations"]
        assert len(recommendations) == 1
        recommendation = recommendations[0]
        assert recommendation["status"] == "INCREASE"
        assert recommendation["recommended_value"] == 82.5
        assert recommendation["previous_value"] == 80
        assert recommendation["difference"] == 2.5
        assert recommendation["reason_code"] == "REP_RANGE_COMPLETED"
        assert recommendation["policy_version"] == "DOUBLE_PROGRESSION_V1"
        assert recommendation["source_session_id"] == workout_id
        assert recommendation["id"] is not None
        assert "12" in recommendation["reason_text"]

        # Next workout: the persisted recommendation is the source of truth.
        next_workout = await flow.start(template_id)
        persisted = await flow.get_recommendation(BENCH_PRESS)
        assert persisted["id"] == recommendation["id"]
        assert persisted["recommended_value"] == 82.5
        assert persisted["reps_min"] == 8
        assert persisted["reps_max"] == 12
        assert persisted["lifecycle_status"] == "generated"

        # Completing another session must not disturb the first prediction.
        second = await flow.complete(
            next_workout,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 11], weight=82.5),
                }
            ],
        )
        assert second["progression_recommendations"][0]["status"] == "KEEP"
        assert second["progression_recommendations"][0]["recommended_value"] == 82.5

    async def test_second_integration_flow_keeps_weight(self, flow: ProgressionFlow):
        """SPEC §56: 12/12/11 -> KEEP 80."""
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 11], weight=80),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["status"] == "KEEP"
        assert recommendation["recommended_value"] == 80
        assert recommendation["difference"] == 0
        assert recommendation["reason_code"] == "TARGET_NOT_COMPLETED"

    async def test_deload_after_three_failures_keeps_program_unchanged(
        self, flow: ProgressionFlow
    ):
        """SPEC §57: 3 failed sessions -> DELOAD recommendation, template untouched."""
        template_id = await flow.create_template()
        await flow.set_policy(
            BENCH_PRESS,
            increment=2.5,
            reps_min=8,
            reps_max=12,
            failure_threshold=3,
            deload_percent=10,
        )

        statuses = []
        for _ in range(3):
            workout_id = await flow.start(template_id)
            completed = await flow.complete(
                workout_id,
                [
                    {
                        "exercise_id": BENCH_PRESS,
                        "name": "Bench Press",
                        "sets_completed": _sets([6, 6, 6], weight=100),
                    }
                ],
            )
            statuses.append(completed["progression_recommendations"][0])

        assert statuses[0]["status"] == "KEEP"
        assert statuses[1]["status"] == "KEEP"
        assert statuses[2]["status"] == "DELOAD"
        assert statuses[2]["recommended_value"] == 90
        assert statuses[2]["reason_code"] == "FAILURE_THRESHOLD_REACHED"
        assert statuses[2]["failure_streak"] == 3

        # The program target is only changed by an explicit accept — and even
        # then the template itself is never rewritten.
        template = await flow.client.get(f"/api/v1/workouts/templates/{template_id}")
        assert template.status_code == 200, template.text
        assert template.json()["exercises"][0]["weight"] == 80

    async def test_warmup_and_dropset_do_not_drive_the_target(
        self, flow: ProgressionFlow
    ):
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": [
                        *_sets([20], weight=40, set_type="warmup"),
                        *_sets([12, 12, 12], weight=80),
                        *_sets([20], weight=40, set_type="dropset"),
                        *_sets([12], weight=80, set_type="failure"),
                    ],
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["previous_value"] == 80
        assert recommendation["recommended_value"] == 82.5

    async def test_cancelled_workout_is_not_evaluated(self, flow: ProgressionFlow):
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        cancelled = await flow.client.post(
            f"/api/v1/workouts/{workout_id}/cancel", json={}
        )
        assert cancelled.status_code == 200, cancelled.text

        recommendation = await flow.client.get(
            f"/api/v1/progression/exercises/{BENCH_PRESS}/recommendation"
        )
        # No session -> nothing to recommend -> 404, never a fake target.
        assert recommendation.status_code == 404
        assert await flow.history(BENCH_PRESS) == []

    async def test_skipped_exercise_creates_no_recommendation(
        self, flow: ProgressionFlow
    ):
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "status": "skipped",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        assert completed["progression_recommendations"] == []
        assert await flow.history(BENCH_PRESS) == []

    async def test_manual_policy_never_proposes_a_value(self, flow: ProgressionFlow):
        template_id = await flow.create_template()
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["status"] == "MANUAL"
        assert recommendation["recommended_value"] is None
        assert recommendation["reason_code"] == "MANUAL_POLICY"
        assert recommendation["previous_value"] == 80

    async def test_rpe_policy_flows_through_the_api(self, flow: ProgressionFlow):
        template_id = await flow.create_template()
        await flow.set_policy(
            BENCH_PRESS,
            type="RPE_BASED",
            increment=2.5,
            sets_target=3,
            target_rpe=8,
        )
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([8, 8, 8], weight=80, rpe=7.5),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["status"] == "INCREASE"
        assert recommendation["recommended_value"] == 82.5
        assert recommendation["reason_code"] == "TARGET_RPE_MET"

    async def test_idempotent_evaluation_of_the_same_session(
        self, flow: ProgressionFlow, authenticated_client: AsyncClient, db_session
    ):
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )

        # Re-evaluating the same finished session must not duplicate rows.
        from app.application.progression_engine_service import ProgressionEngineService
        from app.infrastructure.repositories.workouts_repository import WorkoutsRepository

        repository = WorkoutsRepository(db_session)
        workout = await repository.get_workout(
            user_id=(await flow.get_policy(BENCH_PRESS))["user_id"], workout_id=workout_id
        )
        engine = ProgressionEngineService(db_session)
        first = await engine.evaluate_finished_session(
            user_id=workout.user_id, workout=workout, exercises_payload=workout.exercises
        )
        second = await engine.evaluate_finished_session(
            user_id=workout.user_id, workout=workout, exercises_payload=workout.exercises
        )
        assert first[0]["id"] == second[0]["id"]
        assert second[0]["idempotent_replay"] is True

        count = await db_session.execute(
            select(func.count()).select_from(ProgressionRecommendationRecord)
        )
        assert count.scalar_one() == 1

    async def test_missing_source_session_keeps_the_recommendation(
        self, flow: ProgressionFlow, db_session
    ):
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        from app.domain.workout_log import WorkoutLog

        workout = await db_session.get(WorkoutLog, workout_id)
        await db_session.delete(workout)
        await db_session.commit()

        history = await flow.history(BENCH_PRESS)
        assert len(history) == 1
        # The recommendation survives a deleted session. The FK is ON DELETE SET
        # NULL; SQLite only enforces it with PRAGMA foreign_keys=ON, hence the
        # tolerant assertion (PostgreSQL in CI always nulls it).
        assert history[0]["source_session_id"] in (None, workout_id)
        assert history[0]["recommended_value"] == 82.5

    async def test_same_exercise_in_two_programs_is_independent(
        self, flow: ProgressionFlow
    ):
        monday = await flow.create_template(name="Monday", exercises=[
            {"exercise_id": BENCH_PRESS, "name": "Bench Press", "sets": 3, "reps": 5,
             "weight": 100, "rest_seconds": 120}
        ])
        friday = await flow.create_template(name="Friday", exercises=[
            {"exercise_id": BENCH_PRESS, "name": "Bench Press", "sets": 3, "reps": 12,
             "weight": 80, "rest_seconds": 120}
        ])
        await flow.set_policy(
            BENCH_PRESS, template_id=monday, increment=2.5, reps_min=5, reps_max=5
        )
        await flow.set_policy(
            BENCH_PRESS, template_id=friday, increment=2.5, reps_min=8, reps_max=12
        )

        monday_workout = await flow.start(monday)
        monday_result = await flow.complete(
            monday_workout,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([5, 5, 5], weight=100),
                }
            ],
        )
        friday_workout = await flow.start(friday)
        friday_result = await flow.complete(
            friday_workout,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([10, 9, 9], weight=80),
                }
            ],
        )

        monday_recommendation = monday_result["progression_recommendations"][0]
        friday_recommendation = friday_result["progression_recommendations"][0]
        assert monday_recommendation["scope_key"] != friday_recommendation["scope_key"]
        assert monday_recommendation["recommended_value"] == 102.5
        assert monday_recommendation["status"] == "INCREASE"
        assert friday_recommendation["recommended_value"] == 80
        assert friday_recommendation["status"] == "KEEP"

        assert len(await flow.history(BENCH_PRESS, template_id=monday)) == 1
        assert len(await flow.history(BENCH_PRESS, template_id=friday)) == 1

    async def test_exercise_used_twice_in_one_program_keeps_separate_slots(
        self, flow: ProgressionFlow
    ):
        template_id = await flow.create_template(
            name="Two bench slots",
            exercises=[
                {"exercise_id": BENCH_PRESS, "name": "Bench Press", "sets": 3, "reps": 12,
                 "weight": 80, "rest_seconds": 120},
                {"exercise_id": BENCH_PRESS, "name": "Bench Press (back-off)", "sets": 3,
                 "reps": 12, "weight": 60, "rest_seconds": 120},
            ],
        )
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                },
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press (back-off)",
                    "sets_completed": _sets([8, 8, 8], weight=60),
                },
            ],
        )
        recommendations = completed["progression_recommendations"]
        assert len(recommendations) == 2
        scopes = {item["scope_key"] for item in recommendations}
        assert len(scopes) == 2
        assert recommendations[0]["recommended_value"] == 82.5
        assert recommendations[1]["recommended_value"] == 60

    async def test_deleted_template_keeps_recommendations_readable(
        self, flow: ProgressionFlow
    ):
        template_id = await flow.create_template()
        await flow.set_policy(
            BENCH_PRESS, template_id=template_id, increment=2.5, reps_min=8, reps_max=12
        )
        workout_id = await flow.start(template_id)
        await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        deleted = await flow.client.delete(f"/api/v1/workouts/templates/{template_id}")
        assert deleted.status_code in (200, 204), deleted.text

        history = await flow.history(BENCH_PRESS)
        assert history
        assert history[0]["recommended_value"] == 82.5

    async def test_replaced_exercise_does_not_pollute_the_original_scope(
        self, flow: ProgressionFlow
    ):
        template_id = await flow.create_template(
            name="Replace flow",
            exercises=[
                {"exercise_id": BENCH_PRESS, "name": "Bench Press", "sets": 3, "reps": 12,
                 "weight": 80, "rest_seconds": 120}
            ],
        )
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": SQUAT,
                    "name": "Squat",
                    "sets_completed": _sets([12, 12, 12], weight=100),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["exercise_id"] == SQUAT
        assert recommendation["template_exercise_id"] is None
        assert await flow.history(BENCH_PRESS) == []

    async def test_preview_without_history_is_not_persisted(self, flow: ProgressionFlow):
        response = await flow.client.get(
            f"/api/v1/progression/exercises/{BENCH_PRESS}/recommendation"
        )
        assert response.status_code == 404
        assert await flow.history(BENCH_PRESS) == []


@pytest.mark.integration
class TestProgressionObservability:
    """SPEC §59/§60: structured events + minimal counters, no extra subsystem."""

    async def test_counters_track_evaluations_and_decisions(self, flow: ProgressionFlow):
        from app.core.telemetry.progression_metrics import (
            progression_metrics_snapshot,
            reset_progression_metrics,
        )

        reset_progression_metrics()
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        recommendation_id = completed["progression_recommendations"][0]["id"]
        await flow.accept(recommendation_id)
        await flow.reject(recommendation_id)

        snapshot = progression_metrics_snapshot()
        assert snapshot["progression_evaluations_total"].get("INCREASE") == 1
        assert snapshot["progression_recommendations_total"].get("created") == 1
        assert snapshot["progression_recommendations_total"].get("accepted") == 1
        assert snapshot["progression_recommendations_total"].get("rejected") == 1
        assert "progression_errors_total" in snapshot
        reset_progression_metrics()

    async def test_deload_counter_is_emitted(self, flow: ProgressionFlow):
        from app.core.telemetry.progression_metrics import (
            progression_metrics_snapshot,
            reset_progression_metrics,
        )

        reset_progression_metrics()
        template_id = await flow.create_template()
        await flow.set_policy(
            BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12, failure_threshold=3
        )
        for _ in range(3):
            workout_id = await flow.start(template_id)
            await flow.complete(
                workout_id,
                [
                    {
                        "exercise_id": BENCH_PRESS,
                        "name": "Bench Press",
                        "sets_completed": _sets([6, 6, 6], weight=100),
                    }
                ],
            )

        snapshot = progression_metrics_snapshot()
        assert snapshot["progression_deloads_total"].get("deload") == 1
        reset_progression_metrics()


@pytest.mark.integration
class TestProgressionLifecycle:
    async def _create_recommendation(self, flow: ProgressionFlow) -> dict:
        template_id = await flow.create_template()
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        return completed["progression_recommendations"][0]

    async def test_accept_sets_actual_value(self, flow: ProgressionFlow):
        recommendation = await self._create_recommendation(flow)
        response = await flow.accept(recommendation["id"])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["lifecycle_status"] == "accepted"
        assert body["recommended_value"] == 82.5
        assert body["actual_selected_value"] == 82.5

    async def test_modify_keeps_both_values(self, flow: ProgressionFlow):
        recommendation = await self._create_recommendation(flow)
        response = await flow.accept(recommendation["id"], selected_value=85)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["lifecycle_status"] == "modified"
        assert body["recommended_value"] == 82.5
        assert body["actual_selected_value"] == 85

    async def test_reject_leaves_history_untouched(self, flow: ProgressionFlow):
        recommendation = await self._create_recommendation(flow)
        response = await flow.reject(recommendation["id"])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["lifecycle_status"] == "rejected"
        assert body["actual_selected_value"] is None

        history = await flow.history(BENCH_PRESS)
        assert history[0]["lifecycle_status"] == "rejected"
        assert history[0]["recommended_value"] == 82.5

    async def test_unknown_recommendation_returns_404(self, flow: ProgressionFlow):
        assert (await flow.accept(999999)).status_code == 404
        assert (await flow.reject(999999)).status_code == 404

    async def test_cross_user_access_is_blocked(
        self, flow: ProgressionFlow, client: AsyncClient
    ):
        recommendation = await self._create_recommendation(flow)
        from app.settings import settings
        from app.tests.telegram_webapp import build_init_data

        init_data = build_init_data(
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            user={"id": 987654321, "first_name": "Other", "username": "other"},
        )
        auth = await client.post(
            "/api/v1/users/auth/telegram", json={"init_data": init_data}
        )
        assert auth.status_code == 200, auth.text
        headers = {"Authorization": f"Bearer {auth.json()['access_token']}"}

        response = await client.post(
            f"/api/v1/progression/recommendations/{recommendation['id']}/accept",
            headers=headers,
            json={},
        )
        assert response.status_code == 404


@pytest.mark.integration
class TestAcceptedTargetPrefill:
    """SPEC §42/§58: an accepted target seeds the next session, not the template.

    Starting the same template must open on the accepted weight (82.5 kg) while
    the template keeps its original 80 kg — a ``generated`` proposal never does
    this on its own (SPEC §63/§64).
    """

    async def _session_sets(self, flow: ProgressionFlow, workout_id: int) -> list[dict]:
        response = await flow.client.get(f"/api/v1/workouts/history/{workout_id}")
        assert response.status_code == 200, response.text
        return response.json()["exercises"][0]["sets_completed"]

    async def _create_bench_template(
        self, flow: ProgressionFlow, *, weight: float = 80, name: str = "Bench day"
    ) -> int:
        return await flow.create_template(
            name=name,
            exercises=[
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets": 3,
                    "reps": 12,
                    "weight": weight,
                    "rest_seconds": 120,
                }
            ],
        )

    async def _finish_bench_session(
        self, flow: ProgressionFlow, template_id: int, *, weight: float = 80
    ) -> dict:
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=weight),
                }
            ],
        )
        return completed["progression_recommendations"][0]

    async def _prepared_bench_template(
        self, flow: ProgressionFlow, *, weight: float = 80, name: str = "Bench day"
    ) -> tuple[int, dict]:
        """Template + a 12/12/12 session that produced an INCREASE proposal."""
        template_id = await self._create_bench_template(flow, weight=weight, name=name)
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        recommendation = await self._finish_bench_session(flow, template_id, weight=weight)
        return template_id, recommendation

    async def test_accepted_target_prefills_next_session(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert recommendation["recommended_value"] == 82.5
        assert (await flow.accept(recommendation["id"])).status_code == 200

        sets = await self._session_sets(flow, await flow.start(template_id))

        assert [set_item["weight"] for set_item in sets] == [82.5, 82.5, 82.5]
        assert all(set_item["set_type"] == "working" for set_item in sets)
        assert all(set_item["completed"] is False for set_item in sets)
        # Weight is the only progressed lever: the planned reps stay as planned.
        assert [set_item["reps"] for set_item in sets] == [12, 12, 12]

        template = await flow.client.get(f"/api/v1/workouts/templates/{template_id}")
        assert template.status_code == 200, template.text
        assert template.json()["exercises"][0]["weight"] == 80

    async def test_generated_recommendation_does_not_prefill(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert recommendation["lifecycle_status"] == "generated"

        sets = await self._session_sets(flow, await flow.start(template_id))
        assert [set_item["weight"] for set_item in sets] == [80, 80, 80]

    async def test_modified_target_prefills_the_selected_weight(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        accepted = await flow.accept(recommendation["id"], selected_value=85)
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["actual_selected_value"] == 85

        sets = await self._session_sets(flow, await flow.start(template_id))
        assert [set_item["weight"] for set_item in sets] == [85, 85, 85]

    async def test_rejected_target_does_not_prefill(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.reject(recommendation["id"])).status_code == 200

        sets = await self._session_sets(flow, await flow.start(template_id))
        assert [set_item["weight"] for set_item in sets] == [80, 80, 80]

    async def test_scope_isolation_between_program_slots(self, flow: ProgressionFlow):
        monday, recommendation = await self._prepared_bench_template(flow, name="Monday 3x8-12")
        friday = await self._create_bench_template(flow, weight=60, name="Friday 5x5")
        assert (await flow.accept(recommendation["id"])).status_code == 200

        monday_sets = await self._session_sets(flow, await flow.start(monday))
        friday_sets = await self._session_sets(flow, await flow.start(friday))

        assert [set_item["weight"] for set_item in monday_sets] == [82.5, 82.5, 82.5]
        assert [set_item["weight"] for set_item in friday_sets] == [60, 60, 60]

    async def test_explicit_override_plan_wins_over_accepted_target(
        self, flow: ProgressionFlow
    ):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200

        response = await flow.client.post(
            f"/api/v1/workouts/start/from-template/{template_id}",
            json={
                "name": "Custom session",
                "overrides": {
                    "exercises": [
                        {
                            "exercise_id": BENCH_PRESS,
                            "name": "Bench Press",
                            "sets": 3,
                            "reps": 10,
                            "weight": 70,
                            "rest_seconds": 120,
                        }
                    ]
                },
            },
        )
        assert response.status_code in (200, 201), response.text
        sets = await self._session_sets(flow, response.json()["id"])
        assert [set_item["weight"] for set_item in sets] == [70, 70, 70]

    async def test_timed_target_prefills_duration(self, flow: ProgressionFlow):
        plank = 10
        template_id = await flow.create_template(
            name="Core",
            exercises=[
                {
                    "exercise_id": plank,
                    "name": "Plank",
                    "sets": 3,
                    "duration": 60,
                    "rest_seconds": 60,
                }
            ],
        )
        await flow.set_policy(
            plank,
            type="TIME_PROGRESSION",
            time_target_seconds=60,
            time_increment_seconds=5,
        )
        workout_id = await flow.start(template_id)
        completed = await flow.complete(
            workout_id,
            [
                {
                    "exercise_id": plank,
                    "name": "Plank",
                    "sets_completed": [
                        {
                            "set_number": index + 1,
                            "set_type": "working",
                            "completed": True,
                            "duration": 60,
                        }
                        for index in range(3)
                    ],
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["recommended_value"] == 65
        assert (await flow.accept(recommendation["id"])).status_code == 200

        sets = await self._session_sets(flow, await flow.start(template_id))
        assert [set_item["duration"] for set_item in sets] == [65, 65, 65]
        assert [set_item["weight"] for set_item in sets] == [None, None, None]

    # ─── "Повторить тренировку" (previous_session) ─────────────────────────

    async def _finished_session_with_accepted_target(
        self, flow: ProgressionFlow
    ) -> tuple[int, int, dict]:
        """Template + finished 80×12/12/12 session (warmup included) accepted."""
        template_id = await self._create_bench_template(flow)
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        session_id = await flow.start(template_id)
        completed = await flow.complete(
            session_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": [
                        {
                            "set_number": 1,
                            "set_type": "warmup",
                            "completed": True,
                            "reps": 10,
                            "weight": 40,
                        },
                        {
                            "set_number": 2,
                            "set_type": "working",
                            "completed": True,
                            "reps": 12,
                            "weight": 80,
                        },
                        {
                            "set_number": 3,
                            "set_type": "working",
                            "completed": True,
                            "reps": 12,
                            "weight": 80,
                        },
                        {
                            "set_number": 4,
                            "set_type": "working",
                            "completed": True,
                            "reps": 12,
                            "weight": 80,
                        },
                    ],
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["recommended_value"] == 82.5
        assert (await flow.accept(recommendation["id"])).status_code == 200
        return template_id, session_id, recommendation

    async def test_repeat_start_prefills_the_accepted_target(self, flow: ProgressionFlow):
        template_id, session_id, _ = await self._finished_session_with_accepted_target(flow)

        repeated = await flow.repeat(session_id)

        assert repeated["source_type"] == "previous_session"
        assert repeated["source_id"] == session_id
        # The repeat keeps the template context, so its own evaluation stays in
        # the same progression slot instead of drifting to a template-less scope.
        assert repeated["template_id"] == template_id
        sets = await self._session_sets(flow, repeated["id"])
        assert [(item["set_type"], item["weight"]) for item in sets] == [
            ("warmup", 40),
            ("working", 82.5),
            ("working", 82.5),
            ("working", 82.5),
        ]

        template = await flow.client.get(f"/api/v1/workouts/templates/{template_id}")
        assert template.status_code == 200, template.text
        assert template.json()["exercises"][0]["weight"] == 80

    async def test_repeat_chain_needs_an_accepted_target_to_move_on(
        self, flow: ProgressionFlow
    ):
        _, session_id, _ = await self._finished_session_with_accepted_target(flow)
        first_repeat = await flow.repeat(session_id)
        assert [item["weight"] for item in await self._session_sets(flow, first_repeat["id"])] == [
            40,
            82.5,
            82.5,
            82.5,
        ]

        # The repeat is lifted as planned: the engine proposes 85 but nothing
        # moves until the user accepts — repeating again keeps 82.5 (SPEC §42).
        completed = await flow.complete(
            first_repeat["id"],
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=82.5),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["recommended_value"] == 85

        unaccepted_repeat = await flow.repeat(first_repeat["id"])
        assert [
            item["weight"] for item in await self._session_sets(flow, unaccepted_repeat["id"])
        ] == [82.5, 82.5, 82.5]

        assert (await flow.accept(recommendation["id"])).status_code == 200
        accepted_repeat = await flow.repeat(first_repeat["id"])
        assert [
            item["weight"] for item in await self._session_sets(flow, accepted_repeat["id"])
        ] == [85, 85, 85]

    async def test_repeat_of_a_template_less_session_keeps_previous_weights(
        self, flow: ProgressionFlow
    ):
        session_id = await flow.start()
        await flow.complete(
            session_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([8, 8, 8], weight=75),
                }
            ],
        )

        repeated = await flow.repeat(session_id)

        assert repeated["template_id"] is None
        sets = await self._session_sets(flow, repeated["id"])
        assert [item["weight"] for item in sets] == [75, 75, 75]
        assert [item["reps"] for item in sets] == [8, 8, 8]
