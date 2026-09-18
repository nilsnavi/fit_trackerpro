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

    async def session_exercise(self, workout_id: int) -> dict:
        """First exercise of a session as the client receives it."""
        response = await self.client.get(f"/api/v1/workouts/history/{workout_id}")
        assert response.status_code == 200, response.text
        return response.json()["exercises"][0]

    async def patch_draft(self, workout_id: int, draft: dict) -> dict:
        response = await self.client.patch(
            f"/api/v1/workouts/history/{workout_id}", json={"exercises": [draft]}
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def list_prefill(self, *, declined_only: bool = True) -> dict:
        response = await self.client.get(
            "/api/v1/progression/prefill",
            params={"declined_only": str(declined_only).lower()},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def enable_prefill(self, recommendation_id: int):
        return await self.client.post(
            f"/api/v1/progression/prefill/{recommendation_id}/enable"
        )

    async def disable_prefill(self, recommendation_id: int):
        return await self.client.post(
            f"/api/v1/progression/prefill/{recommendation_id}/disable"
        )

    async def update_target(self, recommendation_id: int, payload: dict):
        """Edit the target itself: value, policy and/or rep range (SPEC §58)."""
        return await self.client.patch(
            f"/api/v1/progression/prefill/{recommendation_id}", json=payload
        )

    async def bulk_disable_prefill(self, recommendation_ids: list[int] | None = None):
        """Switch the prefill off for these targets, or for all of them (SPEC §58)."""
        body = {} if recommendation_ids is None else {"recommendation_ids": recommendation_ids}
        return await self.client.post("/api/v1/progression/prefill/bulk-disable", json=body)

    async def bulk_update_targets(self, recommendation_ids: list[int], payload: dict):
        """Apply one policy / rep-range edit to several targets (SPEC §58)."""
        return await self.client.post(
            "/api/v1/progression/prefill/bulk-update",
            json={"recommendation_ids": recommendation_ids, **payload},
        )


@pytest.fixture
def flow(authenticated_client: AsyncClient) -> ProgressionFlow:
    return ProgressionFlow(authenticated_client)


@pytest.mark.integration
class TestProgressionPolicyApi:
    async def test_requires_authentication(self, client: AsyncClient):
        assert (await client.get("/api/v1/progression/exercises/1")).status_code == 401
        assert (await client.get("/api/v1/progression/prefill")).status_code == 401
        assert (
            await client.post("/api/v1/progression/prefill/1/disable")
        ).status_code == 401
        assert (
            await client.patch("/api/v1/progression/prefill/1", json={"value": 80})
        ).status_code == 401
        assert (
            await client.post("/api/v1/progression/prefill/1/enable")
        ).status_code == 401
        assert (
            await client.get("/api/v1/progression/exercises/1/recommendation")
        ).status_code == 401
        assert (
            await client.post("/api/v1/progression/recommendations/1/accept")
        ).status_code == 401
        assert (
            await client.post("/api/v1/progression/prefill/bulk-disable", json={})
        ).status_code == 401
        assert (
            await client.post(
                "/api/v1/progression/prefill/bulk-update",
                json={"recommendation_ids": [1], "type": "LINEAR"},
            )
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

    The same rule covers sessions without program context (SPEC §7): a repeat of
    a template-less session and an exercise added to a quick start both read the
    accepted ``user + exercise`` target, while two program slots keep their own
    independent sequences.
    """

    async def _session_sets(self, flow: ProgressionFlow, workout_id: int) -> list[dict]:
        response = await flow.client.get(f"/api/v1/workouts/history/{workout_id}")
        assert response.status_code == 200, response.text
        return response.json()["exercises"][0]["sets_completed"]

    async def _session_exercise(self, flow: ProgressionFlow, workout_id: int) -> dict:
        response = await flow.client.get(f"/api/v1/workouts/history/{workout_id}")
        assert response.status_code == 200, response.text
        return response.json()["exercises"][0]

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

    async def test_seeded_session_reports_the_target_and_the_planned_value(
        self, flow: ProgressionFlow
    ):
        """SPEC §58: the UI gets the target and what it replaced, to revert it."""
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200

        started_id = await flow.start(template_id)
        exercise = await self._session_exercise(flow, started_id)

        assert exercise["progression_target"] == {
            "recommendation_id": recommendation["id"],
            "scope_key": recommendation["scope_key"],
            "value": 82.5,
            "unit": "kg",
            "policy": "DOUBLE_PROGRESSION",
            "lifecycle_status": "accepted",
        }
        # Every seeded working set remembers the planned 80 kg it replaced.
        assert [item["planned_weight"] for item in exercise["sets_completed"]] == [
            80,
            80,
            80,
        ]

        # Reverting (what the UI sends back) restores the plan and keeps it put.
        reverted = await self._patch_draft(
            flow,
            started_id,
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets_completed": [
                    {"set_number": item["set_number"], "set_type": "working", "completed": False,
                     "reps": item["reps"], "weight": item["planned_weight"]}
                    for item in exercise["sets_completed"]
                ],
            },
        )
        reverted_exercise = reverted["exercises"][0]
        assert [item["weight"] for item in reverted_exercise["sets_completed"]] == [80, 80, 80]
        assert reverted_exercise.get("progression_target") is None

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

    async def test_repeat_of_a_template_less_session_ignores_an_unaccepted_target(
        self, flow: ProgressionFlow
    ):
        """A proposal alone never moves a session's numbers (SPEC §42/§63)."""
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

    # ─── quick start / template-less scope (SPEC §7) ────────────────────────

    async def _quick_start_with_accepted_target(
        self, flow: ProgressionFlow, *, weight: float = 75
    ) -> tuple[int, dict]:
        """Template-less session 75×12/12/12 with its 77.5 kg target accepted."""
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        session_id = await flow.start()
        completed = await flow.complete(
            session_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=weight),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert recommendation["recommended_value"] == 77.5
        assert (await flow.accept(recommendation["id"])).status_code == 200
        return session_id, recommendation

    @staticmethod
    def _added_draft(weight: float | None = None) -> dict:
        """A quick-start exercise the user just added: three empty sets."""
        return {
            "exercise_id": BENCH_PRESS,
            "name": "Bench Press",
            "sets_completed": [
                {
                    "set_number": index + 1,
                    "set_type": "working",
                    "completed": False,
                    "reps": 12,
                    "weight": weight,
                }
                for index in range(3)
            ],
        }

    async def _patch_draft(
        self, flow: ProgressionFlow, workout_id: int, draft: dict
    ) -> dict:
        response = await flow.client.patch(
            f"/api/v1/workouts/history/{workout_id}",
            json={"exercises": [draft]},
        )
        assert response.status_code == 200, response.text
        return response.json()

    async def test_repeat_of_a_quick_start_uses_the_user_exercise_scope(
        self, flow: ProgressionFlow
    ):
        session_id, recommendation = await self._quick_start_with_accepted_target(flow)
        # A template-less session progresses in the user + exercise scope.
        assert ":t" not in recommendation["scope_key"]

        repeated = await flow.repeat(session_id)

        assert repeated["template_id"] is None
        sets = await self._session_sets(flow, repeated["id"])
        assert [item["weight"] for item in sets] == [77.5, 77.5, 77.5]
        assert [item["reps"] for item in sets] == [12, 12, 12]

    async def test_quick_start_added_exercise_is_seeded_from_the_accepted_target(
        self, flow: ProgressionFlow
    ):
        await self._quick_start_with_accepted_target(flow)
        workout_id = await flow.start()

        detail = await self._patch_draft(flow, workout_id, self._added_draft())

        sets = detail["exercises"][0]["sets_completed"]
        assert [item["weight"] for item in sets] == [77.5, 77.5, 77.5]
        assert [item["completed"] for item in sets] == [False, False, False]

    async def test_quick_start_keeps_the_weight_the_user_typed(
        self, flow: ProgressionFlow
    ):
        await self._quick_start_with_accepted_target(flow)
        workout_id = await flow.start()

        typed = await self._patch_draft(flow, workout_id, self._added_draft(weight=90))
        assert [item["weight"] for item in typed["exercises"][0]["sets_completed"]] == [
            90,
            90,
            90,
        ]

        # Clearing it is a decision too: the target does not come back (SPEC §63).
        cleared = await self._patch_draft(flow, workout_id, self._added_draft())
        assert [item["weight"] for item in cleared["exercises"][0]["sets_completed"]] == [
            None,
            None,
            None,
        ]

    async def test_quick_start_revert_is_not_seeded_again(self, flow: ProgressionFlow):
        """Undoing the substitution must stick, not be re-applied on the next save."""
        await self._quick_start_with_accepted_target(flow)
        workout_id = await flow.start()

        seeded = await self._patch_draft(flow, workout_id, self._added_draft())
        exercise = seeded["exercises"][0]
        assert exercise["progression_target"]["value"] == 77.5
        # The quick start added the exercise empty, so a revert clears the value.
        assert [item["planned_weight"] for item in exercise["sets_completed"]] == [
            None,
            None,
            None,
        ]

        reverted = await self._patch_draft(flow, workout_id, self._added_draft())
        reverted_exercise = reverted["exercises"][0]
        assert [item["weight"] for item in reverted_exercise["sets_completed"]] == [
            None,
            None,
            None,
        ]
        assert reverted_exercise.get("progression_target") is None

    # ─── declined prefill (SPEC §58) ───────────────────────────────────────

    @staticmethod
    def _reverted_payload(exercise: dict) -> dict:
        """What the one-tap revert sends: planned numbers, marker dropped."""
        return {
            "exercise_id": exercise["exercise_id"],
            "name": exercise["name"],
            "sets_completed": [
                {
                    "set_number": item["set_number"],
                    "set_type": item.get("set_type") or "working",
                    "completed": False,
                    "reps": item.get("reps"),
                    "weight": item.get("planned_weight", item.get("weight")),
                    "duration": item.get("planned_duration", item.get("duration")),
                }
                for item in exercise["sets_completed"]
            ],
        }

    async def test_reverting_the_prefill_stops_the_next_one(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200
        started_id = await flow.start(template_id)
        exercise = await self._session_exercise(flow, started_id)
        assert [item["weight"] for item in exercise["sets_completed"]] == [82.5, 82.5, 82.5]

        reverted = await self._patch_draft(flow, started_id, self._reverted_payload(exercise))
        assert [item["weight"] for item in reverted["exercises"][0]["sets_completed"]] == [
            80,
            80,
            80,
        ]

        # The target stays accepted and explainable, only its prefill is off.
        view = await flow.get_recommendation(BENCH_PRESS, template_id=template_id)
        assert view["id"] == recommendation["id"]
        assert view["lifecycle_status"] == "accepted"
        assert view["prefill_declined"] is True
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [80, 80, 80]

    async def test_typing_another_weight_keeps_the_target_live(self, flow: ProgressionFlow):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200
        started_id = await flow.start(template_id)
        exercise = await self._session_exercise(flow, started_id)

        typed = {
            **exercise,
            "sets_completed": [
                item if item.get("set_type") == "warmup" else {**item, "weight": 85}
                for item in exercise["sets_completed"]
            ],
        }
        await self._patch_draft(flow, started_id, typed)

        view = await flow.get_recommendation(BENCH_PRESS, template_id=template_id)
        assert view["prefill_declined"] is False
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [82.5, 82.5, 82.5]

    async def test_accepting_a_new_target_turns_the_prefill_back_on(
        self, flow: ProgressionFlow
    ):
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200
        started_id = await flow.start(template_id)
        exercise = await self._session_exercise(flow, started_id)
        await self._patch_draft(flow, started_id, self._reverted_payload(exercise))
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [80, 80, 80]

        # Lifting the plan again produces a fresh proposal: accepting it is the
        # explicit consent that switches the automatic prefill back on.
        lifted_id = await flow.start(template_id)
        completed = await flow.complete(
            lifted_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=80),
                }
            ],
        )
        fresh = completed["progression_recommendations"][0]
        assert fresh["recommended_value"] == 82.5
        assert (await flow.accept(fresh["id"])).status_code == 200

        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [82.5, 82.5, 82.5]

    async def test_reverting_a_quick_start_seed_stops_the_next_seed(
        self, flow: ProgressionFlow
    ):
        await self._quick_start_with_accepted_target(flow)
        seeded_id = await flow.start()
        seeded = await self._patch_draft(flow, seeded_id, self._added_draft())
        recommendation_id = seeded["exercises"][0]["progression_target"]["recommendation_id"]

        # «Очистить»: the exercise had no plan, so the revert clears the value.
        await self._patch_draft(flow, seeded_id, self._added_draft())
        view = await flow.get_recommendation(BENCH_PRESS)
        assert view["id"] == recommendation_id
        assert view["prefill_declined"] is True

        fresh_id = await flow.start()
        fresh = await self._patch_draft(flow, fresh_id, self._added_draft())
        assert fresh["exercises"][0]["sets_completed"][0]["weight"] is None
        assert fresh["exercises"][0].get("progression_target") is None

    async def test_quick_start_ignores_a_generated_target(
        self, flow: ProgressionFlow
    ):
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        finished = await flow.start()
        await flow.complete(
            finished,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=75),
                }
            ],
        )
        workout_id = await flow.start()

        detail = await self._patch_draft(flow, workout_id, self._added_draft())

        assert [
            item["weight"] for item in detail["exercises"][0]["sets_completed"]
        ] == [None, None, None]


async def accepted_target(
    flow: ProgressionFlow, *, name: str, weight: float = 80
) -> tuple[int, dict]:
    """Template + completed session + accepted target (shared by §58 tests)."""
    template_id = await flow.create_template(
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
    await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
    completed = await flow.complete(
        await flow.start(template_id),
        [
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets_completed": _sets([12, 12, 12], weight=weight),
            }
        ],
    )
    recommendation = completed["progression_recommendations"][0]
    assert (await flow.accept(recommendation["id"])).status_code == 200
    return template_id, recommendation


@pytest.mark.integration
class TestPrefillTargetsApi:
    """SPEC §58: one screen owns the accepted targets — prefill switch and edits."""

    # Kept as a method so the existing call sites read the same as before.
    _accepted_target = staticmethod(accepted_target)

    @staticmethod
    def _reverted_payload(exercise: dict) -> dict:
        """What the one-tap revert sends: planned numbers, marker dropped."""
        return {
            "exercise_id": exercise["exercise_id"],
            "name": exercise["name"],
            "sets_completed": [
                {
                    "set_number": item["set_number"],
                    "set_type": item.get("set_type") or "working",
                    "completed": False,
                    "reps": item.get("reps"),
                    "weight": item.get("planned_weight", item.get("weight")),
                    "duration": item.get("planned_duration", item.get("duration")),
                }
                for item in exercise["sets_completed"]
            ],
        }

    async def _declined_target(
        self, flow: ProgressionFlow, *, name: str
    ) -> tuple[int, dict]:
        """Accepted target the user then undid in the session it prefilled."""
        template_id, recommendation = await self._accepted_target(flow, name=name)
        seeded_id = await flow.start(template_id)
        exercise = await flow.session_exercise(seeded_id)
        assert [item["weight"] for item in exercise["sets_completed"]] == [82.5, 82.5, 82.5]
        reverted = await flow.patch_draft(seeded_id, self._reverted_payload(exercise))
        assert [item["weight"] for item in reverted["exercises"][0]["sets_completed"]] == [
            80,
            80,
            80,
        ]
        return template_id, recommendation

    async def test_lists_only_declined_targets_with_their_context(
        self, flow: ProgressionFlow
    ):
        _, declined = await self._declined_target(flow, name="Monday 3x8-12")
        _, accepted = await self._accepted_target(flow, name="Friday 3x8-12", weight=60)

        listing = await flow.list_prefill(declined_only=True)
        assert listing["total"] == 1
        item = listing["items"][0]
        assert item["id"] == declined["id"]
        assert item["prefill_declined"] is True
        # Catalog name, so the settings screen can label a row without extra calls.
        assert item["exercise_name"] == "Seed Exercise 1"
        assert item["recommended_value"] == 82.5
        assert item["reps_min"] == 8 and item["reps_max"] == 12
        assert item["scope_key"] == declined["scope_key"]

        everything = await flow.list_prefill(declined_only=False)
        assert everything["total"] == 2
        by_id = {entry["id"]: entry for entry in everything["items"]}
        assert by_id[declined["id"]]["prefill_declined"] is True
        assert by_id[accepted["id"]]["prefill_declined"] is False

    async def test_enable_turns_the_prefill_back_on(self, flow: ProgressionFlow):
        template_id, declined = await self._declined_target(flow, name="Monday 3x8-12")
        assert (await flow.list_prefill(declined_only=True))["total"] == 1

        response = await flow.enable_prefill(declined["id"])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["prefill_declined"] is False
        # The target itself was never touched.
        assert body["lifecycle_status"] == "accepted"
        assert body["actual_selected_value"] == 82.5

        assert (await flow.list_prefill(declined_only=True))["total"] == 0
        detail = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in detail["sets_completed"]] == [82.5, 82.5, 82.5]

    async def test_enable_is_idempotent(self, flow: ProgressionFlow):
        _, declined = await self._declined_target(flow, name="Monday 3x8-12")
        first = await flow.enable_prefill(declined["id"])
        second = await flow.enable_prefill(declined["id"])
        assert first.status_code == second.status_code == 200
        assert second.json()["prefill_declined"] is False

    async def test_disable_from_the_list_switches_the_prefill_off(
        self, flow: ProgressionFlow
    ):
        """The settings screen can switch a target off, not only back on."""
        template_id, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        before = await flow.list_prefill(declined_only=False)
        assert [(item["id"], item["prefill_declined"]) for item in before["items"]] == [
            (accepted["id"], False)
        ]

        response = await flow.disable_prefill(accepted["id"])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["prefill_declined"] is True
        # Switching the substitution off never rejects the target itself.
        assert body["lifecycle_status"] == "accepted"
        assert body["actual_selected_value"] == 82.5

        listing = await flow.list_prefill(declined_only=False)
        assert [(item["id"], item["prefill_declined"]) for item in listing["items"]] == [
            (accepted["id"], True)
        ]
        # A new session falls back to the template's own weight.
        detail = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in detail["sets_completed"]] == [80, 80, 80]

    async def test_toggling_a_target_off_and_on_again(self, flow: ProgressionFlow):
        """A full round trip through both prefill states of the same target."""
        template_id, accepted = await self._accepted_target(flow, name="Monday 3x8-12")

        await flow.disable_prefill(accepted["id"])
        assert (await flow.list_prefill(declined_only=True))["total"] == 1
        off = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in off["sets_completed"]] == [80, 80, 80]

        turned_on = await flow.enable_prefill(accepted["id"])
        assert turned_on.json()["prefill_declined"] is False
        assert (await flow.list_prefill(declined_only=True))["total"] == 0
        on = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in on["sets_completed"]] == [82.5, 82.5, 82.5]

    async def test_disable_is_idempotent(self, flow: ProgressionFlow):
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        first = await flow.disable_prefill(accepted["id"])
        second = await flow.disable_prefill(accepted["id"])
        assert first.status_code == second.status_code == 200
        assert second.json()["prefill_declined"] is True
        assert (await flow.list_prefill(declined_only=True))["total"] == 1

    async def test_disable_of_an_unknown_recommendation_returns_404(
        self, flow: ProgressionFlow
    ):
        assert (await flow.disable_prefill(999999)).status_code == 404

    async def test_unknown_recommendation_returns_404(self, flow: ProgressionFlow):
        assert (await flow.enable_prefill(999999)).status_code == 404

    # ─── editing the target itself (value / policy / rep range) ─────────────

    async def test_editing_the_value_moves_the_next_session(self, flow: ProgressionFlow):
        template_id, accepted = await self._accepted_target(flow, name="Monday 3x8-12")

        response = await flow.update_target(accepted["id"], {"value": 85})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["actual_selected_value"] == 85
        # An edited number is a user decision, not the engine's proposal.
        assert body["lifecycle_status"] == "modified"
        # The delta the UI shows follows the edited goal, not the old proposal.
        assert body["previous_value"] == 80
        assert body["difference"] == 5
        assert body["prefill_declined"] is False

        listing = await flow.list_prefill(declined_only=False)
        assert [item["actual_selected_value"] for item in listing["items"]] == [85]
        detail = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in detail["sets_completed"]] == [85, 85, 85]

    async def test_editing_to_the_proposed_number_keeps_it_accepted(
        self, flow: ProgressionFlow
    ):
        """Typing the engine's own suggestion back is not a modification."""
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        response = await flow.update_target(
            accepted["id"], {"value": accepted["recommended_value"]}
        )
        assert response.status_code == 200, response.text
        assert response.json()["lifecycle_status"] == "accepted"

    async def test_editing_the_policy_and_rep_range_keeps_the_value(
        self, flow: ProgressionFlow
    ):
        template_id, accepted = await self._accepted_target(flow, name="Monday 3x8-12")

        response = await flow.update_target(
            accepted["id"], {"type": "LINEAR", "reps_min": 5, "reps_max": 8}
        )
        assert response.status_code == 200, response.text
        body = response.json()
        # The policy that governs the scope now…
        assert body["effective_policy"] == "LINEAR"
        assert body["reps_min"] == 5 and body["reps_max"] == 8
        # …while the recorded policy stays history, and the target itself is intact.
        assert body["policy"] == "DOUBLE_PROGRESSION"
        assert body["actual_selected_value"] == 82.5
        assert body["lifecycle_status"] == "accepted"

        scope = {
            "template_id": body["template_id"],
            "template_exercise_id": body["template_exercise_id"],
        }
        own = await flow.get_policy(BENCH_PRESS, **scope)
        assert own["type"] == "LINEAR"
        assert own["policy_scope_key"] == body["scope_key"]
        # Nothing else was dropped: the slot row is the inherited policy + the edit.
        assert own["reps_min"] == 5 and own["reps_max"] == 8
        assert own["increment"] == 2.5
        # The inherited user-level policy is never rewritten by a slot edit.
        inherited = await flow.get_policy(BENCH_PRESS)
        assert inherited["type"] == "DOUBLE_PROGRESSION"
        assert inherited["increment"] == 2.5
        assert inherited["reps_min"] == 8 and inherited["reps_max"] == 12

        detail = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in detail["sets_completed"]] == [82.5, 82.5, 82.5]

    async def test_switching_the_policy_to_time_prefills_seconds(
        self, flow: ProgressionFlow
    ):
        """A policy edit must reach the next session, not only the settings screen."""
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
        completed = await flow.complete(
            await flow.start(template_id),
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
        assert (await flow.accept(recommendation["id"])).status_code == 200

        response = await flow.update_target(recommendation["id"], {"value": 90})
        assert response.status_code == 200, response.text
        assert response.json()["effective_policy"] == "TIME_PROGRESSION"
        assert response.json()["effective_time_increment_seconds"] == 5

        exercise = await flow.session_exercise(await flow.start(template_id))
        assert [item["duration"] for item in exercise["sets_completed"]] == [90, 90, 90]
        assert exercise["progression_target"]["unit"] == "seconds"

    async def test_editing_a_switched_off_target_keeps_the_prefill_off(
        self, flow: ProgressionFlow
    ):
        """The value moves, the switch stays where the user left it."""
        template_id, declined = await self._declined_target(flow, name="Monday 3x8-12")

        response = await flow.update_target(declined["id"], {"value": 90})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["actual_selected_value"] == 90
        assert body["prefill_declined"] is True

        detail = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in detail["sets_completed"]] == [80, 80, 80]
        listing = await flow.list_prefill(declined_only=True)
        assert body["id"] in [item["id"] for item in listing["items"]]

    async def test_rep_range_must_stay_ordered(self, flow: ProgressionFlow):
        """The edit cannot leave a target with reps_min above reps_max."""
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        response = await flow.update_target(accepted["id"], {"reps_min": 15})
        assert response.status_code == 400, response.text
        assert response.json()["error"]["code"] == "progression_validation"

        # The stored policy is untouched by the rejected edit.
        policy = await flow.get_policy(BENCH_PRESS)
        assert policy["reps_min"] == 8 and policy["reps_max"] == 12

    async def test_an_empty_edit_is_rejected(self, flow: ProgressionFlow):
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        response = await flow.update_target(accepted["id"], {})
        assert response.status_code == 400, response.text
        assert response.json()["error"]["code"] == "progression_validation"

    async def test_editing_an_unknown_target_returns_404(self, flow: ProgressionFlow):
        assert (await flow.update_target(999999, {"value": 80})).status_code == 404

    async def test_cross_user_access_is_blocked(
        self, flow: ProgressionFlow, client: AsyncClient
    ):
        _, declined = await self._declined_target(flow, name="Monday 3x8-12")
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

        assert (
            await client.post(
                f"/api/v1/progression/prefill/{declined['id']}/enable", headers=headers
            )
        ).status_code == 404
        assert (
            await client.post(
                f"/api/v1/progression/prefill/{declined['id']}/disable", headers=headers
            )
        ).status_code == 404
        assert (
            await client.patch(
                f"/api/v1/progression/prefill/{declined['id']}",
                json={"value": 90},
                headers=headers,
            )
        ).status_code == 404
        other_list = await client.get(
            "/api/v1/progression/prefill", params={"declined_only": "true"}, headers=headers
        )
        assert other_list.status_code == 200
        assert other_list.json()["total"] == 0


@pytest.mark.integration
class TestPrefillBulkApi:
    """SPEC §58: bulk actions — one tap instead of walking the list row by row."""

    @staticmethod
    async def _two_targets(
        flow: ProgressionFlow,
    ) -> tuple[int, int, list[dict]]:
        """Two independent accepted targets: different templates, different slots."""
        monday = await accepted_target(flow, name="Monday 3x8-12")
        friday = await accepted_target(flow, name="Friday 3x8-12", weight=60)
        listing = await flow.list_prefill(declined_only=False)
        assert listing["total"] == 2
        return monday[0], friday[0], listing["items"]

    async def test_bulk_disable_switches_off_every_current_target(
        self, flow: ProgressionFlow
    ):
        monday, friday, items = await self._two_targets(flow)

        response = await flow.bulk_disable_prefill()
        assert response.status_code == 200, response.text
        assert response.json() == {"updated": 2, "skipped": [], "applied_to_all": True}

        listing = await flow.list_prefill(declined_only=True)
        assert {item["id"] for item in listing["items"]} == {item["id"] for item in items}
        # Only the silent substitution stops: the targets stay agreed goals.
        assert {item["lifecycle_status"] for item in listing["items"]} == {"accepted"}
        for template_id, weight in ((monday, 80), (friday, 60)):
            detail = await flow.session_exercise(await flow.start(template_id))
            assert [item["weight"] for item in detail["sets_completed"]] == [weight] * 3

    async def test_bulk_disable_only_reaches_the_current_target_per_scope(
        self, flow: ProgressionFlow, db_session
    ):
        """«Выключить всем» must mean the rows the screen lists, not all history."""
        template_id, superseded = await accepted_target(flow, name="Monday 3x8-12")
        # A second cycle in the same slot produces a newer accepted target.
        completed = await flow.complete(
            await flow.start(template_id),
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=82.5),
                }
            ],
        )
        newer = completed["progression_recommendations"][0]
        assert newer["id"] != superseded["id"]
        assert (await flow.accept(newer["id"])).status_code == 200

        assert (await flow.bulk_disable_prefill()).json()["updated"] == 1
        listing = await flow.list_prefill(declined_only=True)
        assert [item["id"] for item in listing["items"]] == [newer["id"]]

        # The superseded record is off the screen, so it was not touched either.
        stale = await db_session.get(ProgressionRecommendationRecord, superseded["id"])
        assert stale.prefill_declined_at is None

    async def test_bulk_disable_with_selected_ids_leaves_the_rest_on(
        self, flow: ProgressionFlow
    ):
        monday, friday, items = await self._two_targets(flow)
        chosen = next(item for item in items if item["template_id"] == monday)

        response = await flow.bulk_disable_prefill([chosen["id"]])
        assert response.status_code == 200, response.text
        assert response.json() == {
            "updated": 1,
            "skipped": [],
            "applied_to_all": False,
        }
        listing = await flow.list_prefill(declined_only=True)
        assert [item["id"] for item in listing["items"]] == [chosen["id"]]

        # Selected target off, the other one still substitutes itself.
        off = await flow.session_exercise(await flow.start(monday))
        assert [item["weight"] for item in off["sets_completed"]] == [80, 80, 80]
        on = await flow.session_exercise(await flow.start(friday))
        assert [item["weight"] for item in on["sets_completed"]] == [62.5, 62.5, 62.5]

    async def test_bulk_disable_is_idempotent_and_reports_skips(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        ids = [item["id"] for item in items]

        first = await flow.bulk_disable_prefill(ids)
        assert first.json()["updated"] == 2
        second = await flow.bulk_disable_prefill(ids)
        assert second.status_code == 200, second.text
        # Already switched off: nothing to rewrite, and every id comes back named
        # with the reason instead of as a bare count.
        body = second.json()
        assert body["updated"] == 0 and body["applied_to_all"] is False
        assert [entry["recommendation_id"] for entry in body["skipped"]] == ids
        for entry, item in zip(body["skipped"], items, strict=True):
            assert entry["reason"] == "already_disabled"
            assert entry["exercise_name"] == "Seed Exercise 1"
            assert entry["value"] == item["actual_selected_value"]
            assert entry["unit"] == "kg"
            assert entry["scope_key"] == item["scope_key"]

    async def test_bulk_disable_all_reports_targets_that_were_already_off(
        self, flow: ProgressionFlow
    ):
        """«Выключить всем» says which goals were already not substituting."""
        _, _, items = await self._two_targets(flow)
        already_off, still_on = items[0], items[1]
        assert (await flow.disable_prefill(already_off["id"])).status_code == 200

        body = (await flow.bulk_disable_prefill()).json()
        assert body["updated"] == 1 and body["applied_to_all"] is True
        assert len(body["skipped"]) == 1
        entry = body["skipped"][0]
        assert entry["recommendation_id"] == already_off["id"]
        assert entry["reason"] == "already_disabled"
        # Named like the list, so the screen can say which goal was left alone.
        assert entry["exercise_name"] == "Seed Exercise 1"
        assert entry["value"] == already_off["actual_selected_value"]
        assert entry["unit"] == "kg"
        assert entry["scope_key"] == already_off["scope_key"]
        assert still_on["id"] not in [item["recommendation_id"] for item in body["skipped"]]

    async def test_bulk_reports_a_rejected_target_as_not_found(
        self, flow: ProgressionFlow
    ):
        """A rejected recommendation is not a target, so a bulk call skips it."""
        _, _, items = await self._two_targets(flow)
        rejected, kept = items[0]["id"], items[1]["id"]
        assert (await flow.reject(rejected)).status_code == 200

        body = (await flow.bulk_disable_prefill([rejected, kept])).json()
        assert body["updated"] == 1
        assert len(body["skipped"]) == 1
        entry = body["skipped"][0]
        assert entry["recommendation_id"] == rejected
        assert entry["reason"] == "not_found"
        # Nothing is left of it to name: the id is all the user can be shown.
        assert entry["exercise_name"] is None
        assert entry["value"] is None and entry["unit"] is None

    async def test_bulk_policy_applies_to_the_selected_targets_only(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        chosen, untouched = items[0], items[1]

        response = await flow.bulk_update_targets(
            [chosen["id"]], {"type": "LINEAR", "reps_min": 5, "reps_max": 8}
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "updated": 1,
            "skipped": [],
            "applied_to_all": False,
        }

        listing = await flow.list_prefill(declined_only=False)
        by_id = {item["id"]: item for item in listing["items"]}
        edited = by_id[chosen["id"]]
        assert edited["effective_policy"] == "LINEAR"
        assert edited["reps_min"] == 5 and edited["reps_max"] == 8
        # The bulk action configures the plan: the number itself stays a per-target
        # decision, and the prefill switch is not flipped either.
        assert edited["actual_selected_value"] == chosen["actual_selected_value"]
        assert edited["prefill_declined"] is False
        assert edited["policy"] == "DOUBLE_PROGRESSION"

        other = by_id[untouched["id"]]
        assert other["effective_policy"] == "DOUBLE_PROGRESSION"
        assert other["reps_min"] == 8 and other["reps_max"] == 12

        # The edit lands in the selected target's own slot, with the inherited row
        # materialized first — the other slot and the user-level policy are intact.
        own = await flow.get_policy(
            BENCH_PRESS,
            template_id=edited["template_id"],
            template_exercise_id=edited["template_exercise_id"],
        )
        assert own["type"] == "LINEAR" and own["increment"] == 2.5
        assert own["policy_scope_key"] == own["scope_key"]
        inherited = await flow.get_policy(BENCH_PRESS)
        assert inherited["type"] == "DOUBLE_PROGRESSION"
        assert inherited["reps_min"] == 8 and inherited["reps_max"] == 12

    async def test_bulk_update_validates_the_whole_selection_before_writing(
        self, flow: ProgressionFlow
    ):
        """A range that only breaks against an inherited bound still writes nothing."""
        _, _, items = await self._two_targets(flow)
        ids = [item["id"] for item in items]

        reversed_pair = await flow.bulk_update_targets(
            ids, {"reps_min": 15, "reps_max": 12}
        )
        assert reversed_pair.status_code == 400, reversed_pair.text
        assert reversed_pair.json()["error"]["code"] == "progression_validation"

        # One-sided edit against each scope's inherited maximum (12).
        against_inherited = await flow.bulk_update_targets(ids, {"reps_min": 15})
        assert against_inherited.status_code == 400, against_inherited.text

        # Neither target was half-edited and no slot got its own policy row.
        by_id = {
            item["id"]: item
            for item in (await flow.list_prefill(declined_only=False))["items"]
        }
        assert by_id[ids[0]]["effective_policy"] == "DOUBLE_PROGRESSION"
        assert by_id[ids[0]]["reps_min"] == 8 and by_id[ids[0]]["reps_max"] == 12
        for item in items:
            own = await flow.get_policy(
                BENCH_PRESS,
                template_id=item["template_id"],
                template_exercise_id=item["template_exercise_id"],
            )
            assert own["policy_scope_key"] != own["scope_key"]

    async def test_bulk_update_requires_ids_and_a_field(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        no_fields = await flow.bulk_update_targets([items[0]["id"]], {})
        assert no_fields.status_code == 400, no_fields.text
        assert no_fields.json()["error"]["code"] == "progression_validation"

        empty = await flow.bulk_update_targets([], {"type": "LINEAR"})
        assert empty.status_code == 422, empty.text

    async def test_bulk_update_reports_ids_that_are_not_targets(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        response = await flow.bulk_update_targets(
            [items[0]["id"], 999999], {"type": "LINEAR"}
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "updated": 1,
            "skipped": [
                {
                    "recommendation_id": 999999,
                    "reason": "not_found",
                    "exercise_id": None,
                    "exercise_name": None,
                    "value": None,
                    "unit": None,
                    "scope_key": None,
                }
            ],
            "applied_to_all": False,
        }

    async def test_bulk_actions_cannot_reach_another_users_targets(
        self, flow: ProgressionFlow, client: AsyncClient
    ):
        _, _, items = await self._two_targets(flow)
        ids = [item["id"] for item in items]

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

        declined = await client.post(
            "/api/v1/progression/prefill/bulk-disable",
            json={"recommendation_ids": ids},
            headers=headers,
        )
        assert declined.status_code == 200, declined.text
        foreign = declined.json()
        assert foreign["updated"] == 0 and foreign["applied_to_all"] is False
        # Another user's targets are simply not targets: each id is named as
        # unknown rather than silently dropped.
        assert [entry["recommendation_id"] for entry in foreign["skipped"]] == ids
        assert {entry["reason"] for entry in foreign["skipped"]} == {"not_found"}
        assert all(entry["exercise_name"] is None for entry in foreign["skipped"])
        edited = await client.post(
            "/api/v1/progression/prefill/bulk-update",
            json={"recommendation_ids": ids, "type": "LINEAR"},
            headers=headers,
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["updated"] == 0

        # «Выключить всем» of the other user must not sweep our targets either.
        everything = await client.post(
            "/api/v1/progression/prefill/bulk-disable", json={}, headers=headers
        )
        assert everything.status_code == 200, everything.text
        assert everything.json()["updated"] == 0

        mine = await flow.list_prefill(declined_only=False)
        assert all(item["prefill_declined"] is False for item in mine["items"])
        assert all(
            item["effective_policy"] == "DOUBLE_PROGRESSION" for item in mine["items"]
        )
