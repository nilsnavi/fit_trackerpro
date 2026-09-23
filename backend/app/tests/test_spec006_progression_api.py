"""SPEC-006 integration tests: evaluation after complete, lifecycle, scopes.

These exercise the real HTTP stack + DB (SQLite in-memory locally, PostgreSQL in
CI), so they cover §40 (evaluation trigger), §41–§44 (API + lifecycle), §52
(idempotency) and §55–§57 (the required integration flows).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.application import workouts_service
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

    async def session_exercises(self, workout_id: int) -> list[dict]:
        """Every exercise of a session as the client receives it (row ids included)."""
        response = await self.client.get(f"/api/v1/workouts/history/{workout_id}")
        assert response.status_code == 200, response.text
        return response.json()["exercises"]

    async def session_exercise(self, workout_id: int) -> dict:
        """First exercise of a session as the client receives it."""
        return (await self.session_exercises(workout_id))[0]

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

    async def bulk_enable_prefill(self, recommendation_ids: list[int]):
        """Switch the prefill back on for these targets — the undo of a sweep."""
        return await self.client.post(
            "/api/v1/progression/prefill/bulk-enable",
            json={"recommendation_ids": recommendation_ids},
        )

    async def bulk_enable_sweeps(self, sweep_ids: list[str]):
        """Undo whole sweeps by their own address — one link or the whole chain."""
        return await self.client.post(
            "/api/v1/progression/prefill/bulk-enable",
            json={"sweep_ids": sweep_ids},
        )

    async def prefill_sweeps(self, limit: int | None = None) -> dict:
        """The chain of sweeps the server can still undo (SPEC §58)."""
        response = await self.client.get(
            "/api/v1/progression/prefill/sweeps",
            params={} if limit is None else {"limit": limit},
        )
        assert response.status_code == 200, response.text
        return response.json()

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
            await client.get("/api/v1/progression/prefill/sweeps")
        ).status_code == 401
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
        assert (
            await client.post(
                "/api/v1/progression/prefill/bulk-enable",
                json={"recommendation_ids": [1]},
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

    async def test_accepting_a_new_target_keeps_the_prefill_off(
        self, flow: ProgressionFlow
    ):
        """«Не подставлять» — решение о слоте, поэтому новая цель его наследует."""
        template_id, recommendation = await self._prepared_bench_template(flow)
        assert (await flow.accept(recommendation["id"])).status_code == 200
        started_id = await flow.start(template_id)
        exercise = await self._session_exercise(flow, started_id)
        await self._patch_draft(flow, started_id, self._reverted_payload(exercise))
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [80, 80, 80]

        # Lifting the plan again produces a fresh proposal: accepting it is consent
        # to *that number*, not to start substituting silently again.
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

        view = await flow.get_recommendation(BENCH_PRESS, template_id=template_id)
        assert view["id"] == fresh["id"]
        assert view["prefill_declined"] is True
        # The refusal outlives the row it was made on: the next session still starts
        # on the plan, until the switch is turned back on where it is visible.
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [80, 80, 80]

    async def test_the_replaced_target_hands_the_refusal_over_unchanged(
        self, flow: ProgressionFlow, db_session
    ):
        """The new row carries the decision *and* its moment — not a new one."""
        template_id, first = await self._prepared_bench_template(flow)
        assert (await flow.accept(first["id"])).status_code == 200
        started_id = await flow.start(template_id)
        await self._patch_draft(
            flow,
            started_id,
            self._reverted_payload(await self._session_exercise(flow, started_id)),
        )
        replaced = await db_session.get(ProgressionRecommendationRecord, first["id"])
        await db_session.refresh(replaced)
        assert replaced.prefill_declined_at is not None

        fresh = await self._finish_bench_session(flow, template_id)
        assert (await flow.accept(fresh["id"])).status_code == 200

        carried = await db_session.get(ProgressionRecommendationRecord, fresh["id"])
        await db_session.refresh(carried)
        # The same moment, not a fresh one: the substitution has been off since the
        # user said so, and the journal keeps saying exactly that.
        assert carried.prefill_declined_at == replaced.prefill_declined_at
        # A single flip was nobody's sweep, so the carry hands over nothing else.
        assert carried.prefill_sweep_id is None
        assert replaced.prefill_sweep_id is None

    async def test_a_target_that_does_not_take_the_slot_inherits_nothing(
        self, flow: ProgressionFlow, db_session
    ):
        """The refusal follows the slot, so it never leaks backwards."""
        template_id, first = await self._prepared_bench_template(flow)
        assert (await flow.accept(first["id"])).status_code == 200
        started_id = await flow.start(template_id)
        await self._patch_draft(
            flow,
            started_id,
            self._reverted_payload(await self._session_exercise(flow, started_id)),
        )
        # The next cycle's target takes the slot and inherits the refusal, and the
        # user then turns the substitution back on for that slot.
        fresh = await self._finish_bench_session(flow, template_id)
        assert (await flow.accept(fresh["id"])).status_code == 200
        assert (await flow.enable_prefill(fresh["id"])).status_code == 200

        # Accepting the older, switched-off row now does not take the slot (a newer
        # goal owns it), so it inherits nothing and switches nothing off.
        assert (await flow.accept(first["id"])).status_code == 200
        view = await flow.get_recommendation(BENCH_PRESS, template_id=template_id)
        assert view["id"] == fresh["id"]
        assert view["prefill_declined"] is False
        stale = await db_session.get(ProgressionRecommendationRecord, first["id"])
        await db_session.refresh(stale)
        assert stale.prefill_declined_at is not None
        # The slot still substitutes the goal that owns it — the older row's own
        # refusal never leaks into the accept that did not take the slot.
        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [float(view["actual_selected_value"])] * 3

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

    # ─── the inherited refusal in a template-less scope (SPEC §58) ──────────
    #
    # Without a program the accepted target lives in the ``user + exercise``
    # scope, and the refusal is a property of that scope: a newer target the
    # user accepts inherits it, so «не подставлять» lasts across cycles here
    # exactly as it does inside a program slot. Every template-less entry point
    # — a quick start, «Повторить тренировку», an exercise added mid-session —
    # reads the same accepted target, so all three have to honour it.

    async def _declined_user_scope_target(self, flow: ProgressionFlow) -> dict:
        """Switch the prefill off for the template-less 77.5 kg target.

        The refusal is made the way the client makes it: a quick start seeds the
        added exercise on 77.5, and sending the planned numbers back is the
        one-tap «вернуть» the session update records against that target.
        """
        await self._quick_start_with_accepted_target(flow)
        workout_id = await flow.start()
        seeded = await self._patch_draft(flow, workout_id, self._added_draft())
        assert seeded["exercises"][0]["progression_target"]["value"] == 77.5

        await self._patch_draft(flow, workout_id, self._added_draft())
        view = await flow.get_recommendation(BENCH_PRESS)
        assert view["prefill_declined"] is True
        return view

    async def _next_user_scope_session(
        self, flow: ProgressionFlow
    ) -> tuple[int, dict]:
        """Finish another template-less session and accept its fresh 80 kg target."""
        session_id = await flow.start()
        completed = await flow.complete(
            session_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=77.5),
                }
            ],
        )
        fresh = completed["progression_recommendations"][0]
        assert fresh["recommended_value"] == 80
        assert (await flow.accept(fresh["id"])).status_code == 200
        return session_id, fresh

    async def test_the_fresh_user_scope_target_inherits_the_refusal(
        self, flow: ProgressionFlow, db_session
    ):
        """The next accepted target carries the decision *and* its moment (§58)."""
        declined = await self._declined_user_scope_target(flow)
        _session_id, fresh = await self._next_user_scope_session(flow)

        view = await flow.get_recommendation(BENCH_PRESS)
        assert view["id"] == fresh["id"]
        assert view["prefill_declined"] is True

        carried = await db_session.get(ProgressionRecommendationRecord, fresh["id"])
        await db_session.refresh(carried)
        source = await db_session.get(ProgressionRecommendationRecord, declined["id"])
        await db_session.refresh(source)
        # The same moment, not a new one: the substitution has been off since the
        # user said so. A single flip was nobody's sweep, so nothing travels with
        # it beyond the decision itself.
        assert carried.prefill_declined_at == source.prefill_declined_at
        assert carried.prefill_sweep_id is None

    async def test_a_quick_start_added_exercise_respects_the_inherited_refusal(
        self, flow: ProgressionFlow
    ):
        """Быстрый старт: an added exercise starts blank, not on the target."""
        await self._declined_user_scope_target(flow)
        await self._next_user_scope_session(flow)

        detail = await self._patch_draft(flow, await flow.start(), self._added_draft())

        exercise = detail["exercises"][0]
        assert [item["weight"] for item in exercise["sets_completed"]] == [None, None, None]
        assert exercise.get("progression_target") is None

    async def test_an_exercise_added_to_a_session_without_a_template_is_not_seeded(
        self, flow: ProgressionFlow
    ):
        """A template-less session with content: typed values and the refusal win."""
        await self._declined_user_scope_target(flow)
        await self._next_user_scope_session(flow)

        workout_id = await flow.start()
        typed = self._added_draft(weight=60)
        drafts = [typed, {**self._added_draft(), "name": "Bench Press (second)"}]
        response = await flow.client.patch(
            f"/api/v1/workouts/history/{workout_id}", json={"exercises": drafts}
        )
        assert response.status_code == 200, response.text
        detail = response.json()

        assert [
            item["weight"] for item in detail["exercises"][0]["sets_completed"]
        ] == [60, 60, 60]
        assert detail["exercises"][0].get("progression_target") is None
        assert [
            item["weight"] for item in detail["exercises"][1]["sets_completed"]
        ] == [None, None, None]
        assert detail["exercises"][1].get("progression_target") is None

    async def test_a_repeat_of_a_template_less_session_respects_the_inherited_refusal(
        self, flow: ProgressionFlow
    ):
        """«Повторить тренировку» keeps the copied 77.5, not the switched-off 80."""
        await self._declined_user_scope_target(flow)
        session_id, _fresh = await self._next_user_scope_session(flow)

        repeated = await flow.repeat(session_id)

        assert repeated["template_id"] is None
        sets = await self._session_sets(flow, repeated["id"])
        assert [item["weight"] for item in sets] == [77.5, 77.5, 77.5]
        assert [item["reps"] for item in sets] == [12, 12, 12]

    async def test_a_refusal_made_on_the_settings_screen_is_inherited_too(
        self, flow: ProgressionFlow
    ):
        """The switch-off does not have to come from a session to travel (§58)."""
        session_id, first = await self._quick_start_with_accepted_target(flow)
        assert (await flow.disable_prefill(first["id"])).status_code == 200
        assert (await flow.get_recommendation(BENCH_PRESS))["prefill_declined"] is True

        _session_id, fresh = await self._next_user_scope_session(flow)
        view = await flow.get_recommendation(BENCH_PRESS)
        assert view["id"] == fresh["id"]
        assert view["prefill_declined"] is True

        # Both template-less entry points stay off: the added exercise starts
        # blank and the repeat keeps what the source session did.
        seeded = await self._patch_draft(flow, await flow.start(), self._added_draft())
        assert [
            item["weight"] for item in seeded["exercises"][0]["sets_completed"]
        ] == [None, None, None]
        repeated = await flow.repeat(session_id)
        assert [
            item["weight"] for item in await self._session_sets(flow, repeated["id"])
        ] == [75, 75, 75]

    async def test_turning_the_inherited_prefill_back_on_moves_the_template_less_paths(
        self, flow: ProgressionFlow
    ):
        """Explicit consent switches the scope back on for every entry point."""
        await self._declined_user_scope_target(flow)
        session_id, fresh = await self._next_user_scope_session(flow)
        assert (await flow.enable_prefill(fresh["id"])).status_code == 200

        repeated = await flow.repeat(session_id)
        assert [
            item["weight"] for item in await self._session_sets(flow, repeated["id"])
        ] == [80, 80, 80]
        seeded = await self._patch_draft(flow, await flow.start(), self._added_draft())
        assert [
            item["weight"] for item in seeded["exercises"][0]["sets_completed"]
        ] == [80, 80, 80]

    async def test_a_declined_slot_does_not_switch_off_the_quick_start_scope(
        self, flow: ProgressionFlow
    ):
        """A program slot and the user + exercise scope keep separate decisions."""
        template_id, slot_target = await self._prepared_bench_template(flow)
        assert (await flow.accept(slot_target["id"])).status_code == 200
        started_id = await flow.start(template_id)
        await self._patch_draft(
            flow,
            started_id,
            self._reverted_payload(await self._session_exercise(flow, started_id)),
        )
        assert (
            await flow.get_recommendation(BENCH_PRESS, template_id=template_id)
        )["prefill_declined"] is True

        _session_id, quick_start_target = await self._quick_start_with_accepted_target(flow)
        # Accepted as proposed, so the target's value is the proposal itself.
        value = float(quick_start_target["recommended_value"])
        seeded = await self._patch_draft(flow, await flow.start(), self._added_draft())
        assert [
            item["weight"] for item in seeded["exercises"][0]["sets_completed"]
        ] == [value, value, value]

    async def test_a_quick_start_refusal_does_not_switch_off_a_program_slot(
        self, flow: ProgressionFlow
    ):
        """The other direction: the settings screen still shows the slot on."""
        declined = await self._declined_user_scope_target(flow)
        assert declined["prefill_declined"] is True

        template_id, slot_target = await self._prepared_bench_template(flow)
        assert (await flow.accept(slot_target["id"])).status_code == 200

        assert [
            item["weight"] for item in await self._session_sets(flow, await flow.start(template_id))
        ] == [82.5, 82.5, 82.5]


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


async def slot_with_two_records(flow: ProgressionFlow) -> tuple[dict, dict]:
    """One slot holding two accepted records: a second cycle supersedes the first.

    The settings list shows only the newest one, while the older record stays an
    accepted, valued target in the data — which is exactly the overlap a selection
    (or a stale editor) can address.
    """
    template_id, superseded = await accepted_target(flow, name="Monday 3x8-12")
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
    return superseded, newer


# ─── the prefill entry-point matrix (SPEC §58) ─────────────────────────────
#
# Every way a session can receive an accepted target is one row in
# ``PREFILL_ENTRY_POINTS``, and the matrix below is generated from those rows
# instead of being written by hand. Registering an entry point is therefore the
# whole job: it gets both halves of the decision — the target substituting and
# the refusal holding it back — plus the explicit-consent case for free, and the
# guard test at the end keeps the table honest against the code, so a new way of
# seeding a session cannot slip in uncovered.

_MATRIX_WORKING_SETS = 3
_MATRIX_PLAN_WEIGHT = 80.0
_SQUAT_PLAN_WEIGHT = 60.0


def _blank_bench_draft(weight: float | None = None) -> dict:
    """An exercise the client just added: empty working sets, nothing typed."""
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
            for index in range(_MATRIX_WORKING_SETS)
        ],
    }


def _typed_draft(exercise_id: int, name: str, weight: float) -> dict:
    """An exercise the user filled in by hand: never seeded, only kept."""
    return {
        "exercise_id": exercise_id,
        "name": name,
        "sets_completed": [
            {
                "set_number": index + 1,
                "set_type": "working",
                "completed": False,
                "reps": 12,
                "weight": weight,
            }
            for index in range(_MATRIX_WORKING_SETS)
        ],
    }


async def _patch_exercises(
    flow: ProgressionFlow, workout_id: int, exercises: list[dict]
) -> dict:
    """A session update carrying a whole exercise list, as the client sends it."""
    response = await flow.client.patch(
        f"/api/v1/workouts/history/{workout_id}", json={"exercises": exercises}
    )
    assert response.status_code == 200, response.text
    return response.json()


def _working_weights(exercise: dict) -> list[float | None]:
    """The weights of the working sets — what the prefill actually moves."""
    return [
        item.get("weight")
        for item in exercise.get("sets_completed", [])
        if (item.get("set_type") or "working") == "working"
    ]


def _cleared_draft(exercise: dict) -> dict:
    """The session's own entry with its numbers cleared: same row id, no marker."""
    cleared = {
        **exercise,
        "sets_completed": [
            {**item, "weight": None, "duration": None}
            for item in exercise.get("sets_completed", [])
        ],
    }
    cleared.pop("progression_target", None)
    return cleared


async def _sync_loaded_session(flow: ProgressionFlow, workout_id: int) -> list[dict]:
    """Send the session back as the client holds it — row ids included (§58).

    The server stores the payload it receives, so this is what makes an entry
    identifiable at all: the drafts a session is created from carry no row id,
    and only the client's own sync puts them in. Without it, nothing could tell
    a cleared field from an exercise the user just added back by hand.
    """
    loaded = await flow.session_exercises(workout_id)
    await _patch_exercises(flow, workout_id, loaded)
    return loaded


async def _prepare_two_lift_slot(flow: ProgressionFlow) -> tuple[int, dict]:
    """A program of two lifts with the bench slot's target accepted (82.5 on 80).

    The squat is there so the bench is not the whole list: its own numbers stay
    the plan's, which is how a neighbouring entry shows it was left alone.
    """
    template_id = await flow.create_template(
        name="Two-lift slot",
        exercises=[
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets": _MATRIX_WORKING_SETS,
                "reps": 12,
                "weight": _MATRIX_PLAN_WEIGHT,
                "rest_seconds": 120,
            },
            {
                "exercise_id": SQUAT,
                "name": "Back Squat",
                "sets": _MATRIX_WORKING_SETS,
                "reps": 12,
                "weight": _SQUAT_PLAN_WEIGHT,
                "rest_seconds": 120,
            },
        ],
    )
    await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
    completed = await flow.complete(
        await flow.start(template_id),
        [
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets_completed": _sets([12] * _MATRIX_WORKING_SETS, weight=_MATRIX_PLAN_WEIGHT),
            },
            {
                "exercise_id": SQUAT,
                "name": "Back Squat",
                "sets_completed": _sets([12] * _MATRIX_WORKING_SETS, weight=_SQUAT_PLAN_WEIGHT),
            },
        ],
    )
    bench_target = next(
        item
        for item in completed["progression_recommendations"]
        if item["exercise_id"] == BENCH_PRESS
    )
    assert bench_target["recommended_value"] == 82.5
    assert (await flow.accept(bench_target["id"])).status_code == 200
    return template_id, bench_target


@dataclass
class PreparedEntryPoint:
    """What an entry point needs to be opened again: its scope and first target."""

    template_id: int | None
    session_id: int
    target: dict


@dataclass(frozen=True)
class PrefillEntryPoint:
    """One registered way a session can be seeded with an accepted target."""

    #: Stable test id, so dropping or renaming a row is visible in the report.
    name: str
    #: The ``WorkoutsService`` method that performs the substitution.
    path: str
    #: What the session keeps when the scope's prefill is switched off.
    plan_weight: float | None
    prepare: Callable[[ProgressionFlow], Awaitable[PreparedEntryPoint]]
    #: Accept a newer target in the same scope; returns the scope's view of it.
    next_target: Callable[[ProgressionFlow, PreparedEntryPoint], Awaitable[dict]]
    #: Run the entry point; returns the first exercise as the client receives it.
    open_session: Callable[[ProgressionFlow, PreparedEntryPoint], Awaitable[dict]]


async def _matrix_finish_session(
    flow: ProgressionFlow, *, template_id: int | None, weight: float
) -> tuple[int, dict]:
    """One finished 12/12/12 session on the scope, with its target accepted."""
    session_id = await flow.start(template_id)
    completed = await flow.complete(
        session_id,
        [
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets_completed": _sets([12] * _MATRIX_WORKING_SETS, weight=weight),
            }
        ],
    )
    target = completed["progression_recommendations"][0]
    assert (await flow.accept(target["id"])).status_code == 200
    return session_id, target


async def _prepare_slot(flow: ProgressionFlow) -> PreparedEntryPoint:
    """A program slot: template + first cycle, accepted 82.5 kg on a 80 plan."""
    template_id = await flow.create_template(
        name="Matrix slot",
        exercises=[
            {
                "exercise_id": BENCH_PRESS,
                "name": "Bench Press",
                "sets": _MATRIX_WORKING_SETS,
                "reps": 12,
                "weight": _MATRIX_PLAN_WEIGHT,
                "rest_seconds": 120,
            }
        ],
    )
    await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
    session_id, target = await _matrix_finish_session(
        flow, template_id=template_id, weight=_MATRIX_PLAN_WEIGHT
    )
    return PreparedEntryPoint(template_id=template_id, session_id=session_id, target=target)


async def _prepare_user_scope(flow: ProgressionFlow) -> PreparedEntryPoint:
    """No program: a quick-start cycle, accepted 77.5 kg on a 75 kg session."""
    await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
    session_id, target = await _matrix_finish_session(flow, template_id=None, weight=75.0)
    return PreparedEntryPoint(template_id=None, session_id=session_id, target=target)


async def _slot_next_target(flow: ProgressionFlow, prepared: PreparedEntryPoint) -> dict:
    """A newer cycle in the same slot: lifts 82.5, so the fresh target is 85."""
    await _matrix_finish_session(flow, template_id=prepared.template_id, weight=82.5)
    return await flow.get_recommendation(BENCH_PRESS, template_id=prepared.template_id)


async def _user_scope_next_target(flow: ProgressionFlow, prepared: PreparedEntryPoint) -> dict:
    """A newer template-less cycle: lifts 77.5, so the fresh target is 80."""
    await _matrix_finish_session(flow, template_id=None, weight=77.5)
    return await flow.get_recommendation(BENCH_PRESS)


async def _open_template_start(flow: ProgressionFlow, prepared: PreparedEntryPoint) -> dict:
    """Plain start of the template."""
    return await flow.session_exercise(await flow.start(prepared.template_id))


async def _open_repeat(flow: ProgressionFlow, prepared: PreparedEntryPoint) -> dict:
    """«Повторить тренировку»: start from the finished session's own numbers."""
    repeated = await flow.repeat(prepared.session_id)
    return await flow.session_exercise(repeated["id"])


async def _open_added_exercise(flow: ProgressionFlow, prepared: PreparedEntryPoint) -> dict:
    """Quick start, then the exercise is added to the open session."""
    detail = await flow.patch_draft(await flow.start(), _blank_bench_draft())
    return detail["exercises"][0]


async def _open_added_exercise_in_template(
    flow: ProgressionFlow, prepared: PreparedEntryPoint
) -> dict:
    """A template session where the program's own lift is re-added empty.

    The client sends the whole list, so the planned lift sits behind the exercise
    the user typed: the payload position no longer matches what the session
    stored, which is exactly when an added exercise has to be seeded.
    """
    session_id = await flow.start(prepared.template_id)
    detail = await _patch_exercises(
        flow,
        session_id,
        [_typed_draft(SQUAT, "Back Squat", 60.0), _blank_bench_draft()],
    )
    return detail["exercises"][1]


async def _open_re_added_exercise_in_template(
    flow: ProgressionFlow, prepared: PreparedEntryPoint
) -> dict:
    """A program slot whose own lift was deleted and added back where it stood.

    The client syncs the session it loaded (row ids included) and then sends the
    list with the lift put back by hand: the payload looks like the stored one
    again, so only the re-added draft's missing row id tells the two apart.
    """
    session_id = await flow.start(prepared.template_id)
    await _sync_loaded_session(flow, session_id)
    detail = await _patch_exercises(flow, session_id, [_blank_bench_draft()])
    return detail["exercises"][0]


PREFILL_ENTRY_POINTS: tuple[PrefillEntryPoint, ...] = (
    PrefillEntryPoint(
        name="template_start",
        path="create_workout_session",
        plan_weight=_MATRIX_PLAN_WEIGHT,
        prepare=_prepare_slot,
        next_target=_slot_next_target,
        open_session=_open_template_start,
    ),
    PrefillEntryPoint(
        name="repeat_with_template",
        path="create_workout_session",
        plan_weight=_MATRIX_PLAN_WEIGHT,
        prepare=_prepare_slot,
        next_target=_slot_next_target,
        open_session=_open_repeat,
    ),
    PrefillEntryPoint(
        name="repeat_without_template",
        path="create_workout_session",
        plan_weight=75.0,
        prepare=_prepare_user_scope,
        next_target=_user_scope_next_target,
        open_session=_open_repeat,
    ),
    PrefillEntryPoint(
        name="exercise_added_without_template",
        path="_seed_added_exercise_targets",
        plan_weight=None,
        prepare=_prepare_user_scope,
        next_target=_user_scope_next_target,
        open_session=_open_added_exercise,
    ),
    PrefillEntryPoint(
        name="exercise_added_with_template",
        path="_seed_added_exercise_targets",
        plan_weight=None,
        prepare=_prepare_slot,
        next_target=_slot_next_target,
        open_session=_open_added_exercise_in_template,
    ),
    PrefillEntryPoint(
        name="exercise_re_added_with_template",
        path="_seed_added_exercise_targets",
        plan_weight=None,
        prepare=_prepare_slot,
        next_target=_slot_next_target,
        open_session=_open_re_added_exercise_in_template,
    ),
)


def _entry_id(entry: PrefillEntryPoint) -> str:
    return entry.name


def _prefill_call_sites(source: str) -> set[str]:
    """``WorkoutsService`` methods that call the one function seeding a session.

    A small scan rather than an import-time trick: the point is to fail when a
    *new* call site appears, and the file's layout makes that reliable — only
    class-level ``def`` lines restart the caller, so a nested helper is reported
    as its enclosing entry point rather than as a separate one.
    """
    caller: str | None = None
    callers: set[str] = set()
    for line in source.splitlines():
        if line.startswith(("    def ", "    async def ")):
            caller = line.split("def ", 1)[1].split("(", 1)[0].strip()
            continue
        if "_apply_accepted_progression_targets(" in line and caller is not None:
            callers.add(caller)
    return callers


@pytest.mark.integration
class TestPrefillEntryPointMatrix:
    """SPEC §58: every entry point answers the scope's refusal the same way.

    The table at module level is the whole registry, and both states come from
    it: a new way of starting or seeding a session is one row there — never a
    test of its own — and the matrix below then asks it the same questions as
    every other entry point.
    """

    @pytest.mark.parametrize("entry", PREFILL_ENTRY_POINTS, ids=_entry_id)
    @pytest.mark.parametrize("declined", [False, True], ids=["prefill_on", "prefill_off"])
    async def test_the_entry_point_obeys_the_scopes_refusal(
        self, flow: ProgressionFlow, entry: PrefillEntryPoint, declined: bool
    ):
        prepared = await entry.prepare(flow)
        if declined:
            # The refusal is switched off for the current target and then a newer
            # target is accepted in the same scope: whatever the entry point does
            # afterwards answers the *inherited* decision, not a fresh one.
            assert (await flow.disable_prefill(prepared.target["id"])).status_code == 200

        newer = await entry.next_target(flow, prepared)

        assert newer["id"] != prepared.target["id"]
        assert newer["prefill_declined"] is declined
        value = float(newer["actual_selected_value"])
        assert value != entry.plan_weight, "the matrix case would be vacuous"

        weights = _working_weights(await entry.open_session(flow, prepared))

        expected = entry.plan_weight if declined else value
        assert weights == [expected] * _MATRIX_WORKING_SETS

    @pytest.mark.parametrize("entry", PREFILL_ENTRY_POINTS, ids=_entry_id)
    async def test_explicit_consent_puts_the_entry_point_back(
        self, flow: ProgressionFlow, entry: PrefillEntryPoint
    ):
        """The refusal is the only thing holding the substitution back (§58)."""
        prepared = await entry.prepare(flow)
        assert (await flow.disable_prefill(prepared.target["id"])).status_code == 200
        newer = await entry.next_target(flow, prepared)
        assert newer["prefill_declined"] is True
        assert (await flow.enable_prefill(newer["id"])).status_code == 200
        value = float(newer["actual_selected_value"])

        weights = _working_weights(await entry.open_session(flow, prepared))

        assert weights == [value] * _MATRIX_WORKING_SETS

    async def test_an_exercise_the_session_already_carries_is_never_re_seeded(
        self, flow: ProgressionFlow
    ):
        """Blanking a seeded number out sticks — the session's own entry wins (§58).

        This is what keeps the seeding above from being a loop: an entry the
        session already stores is only ever seeded once, so «вернуть» and a
        cleared field both stay as the user left them inside a program too.
        """
        prepared = await _prepare_slot(flow)
        session_id = await flow.start(prepared.template_id)
        # The client's own sync, row ids included: what the entry is identified by
        # from here on.
        loaded = await _sync_loaded_session(flow, session_id)
        assert _working_weights(loaded[0]) == [82.5] * _MATRIX_WORKING_SETS

        detail = await _patch_exercises(flow, session_id, [_cleared_draft(loaded[0])])

        assert _working_weights(detail["exercises"][0]) == [None] * _MATRIX_WORKING_SETS

    async def test_a_payload_without_row_ids_still_counts_as_the_same_entry(
        self, flow: ProgressionFlow
    ):
        """Position is the only evidence there is when nothing carries a row id.

        A client that never sends them (or a session stored before the rows were
        enriched) cannot be told apart from a cleared field, so the stored entry
        keeps winning — the seeding stays a one-shot rather than a loop.
        """
        prepared = await _prepare_slot(flow)
        session_id = await flow.start(prepared.template_id)
        exercise = await flow.session_exercise(session_id)
        assert exercise["id"] is not None, "the client receives the row id"
        assert _working_weights(exercise) == [82.5] * _MATRIX_WORKING_SETS
        # Same shape, ids stripped, as a client that never sends them would.
        detail = await flow.patch_draft(
            session_id,
            {
                "exercise_id": exercise["exercise_id"],
                "name": exercise["name"],
                "sets_completed": [
                    {
                        "set_number": item["set_number"],
                        "set_type": item.get("set_type") or "working",
                        "completed": False,
                        "reps": item.get("reps"),
                        "weight": None,
                    }
                    for item in exercise["sets_completed"]
                ],
            },
        )

        assert _working_weights(detail["exercises"][0]) == [None] * _MATRIX_WORKING_SETS

    async def test_a_re_added_planned_exercise_in_the_same_position_is_seeded_again(
        self, flow: ProgressionFlow
    ):
        """Deleted and added back where it stood, a planned lift finds its slot.

        The payload looks like the stored list again — same exercise, same index —
        so only the entries themselves say that this one is new: the draft the
        user put back carries no row id, while the entry it replaced does.
        """
        template_id, _ = await _prepare_two_lift_slot(flow)
        session_id = await flow.start(template_id)
        loaded = await _sync_loaded_session(flow, session_id)
        assert _working_weights(loaded[0]) == [82.5] * _MATRIX_WORKING_SETS

        # The bench goes away and comes back by hand in its own place; the squat
        # is the entry the session carries, so nothing about it changes.
        detail = await _patch_exercises(flow, session_id, [_blank_bench_draft(), loaded[1]])

        assert _working_weights(detail["exercises"][0]) == [82.5] * _MATRIX_WORKING_SETS
        assert detail["exercises"][0]["progression_target"]["value"] == 82.5
        assert _working_weights(detail["exercises"][1]) == [_SQUAT_PLAN_WEIGHT] * _MATRIX_WORKING_SETS

    async def test_a_carried_entry_keeps_its_cleared_number_wherever_it_moves(
        self, flow: ProgressionFlow
    ):
        """Identity travels with the entry, so a reorder does not re-seed it.

        A cleared field stays cleared even after the list was shuffled: the entry
        is the same row, and the place it sits is not what makes it the session's.
        """
        template_id, _ = await _prepare_two_lift_slot(flow)
        session_id = await flow.start(template_id)
        loaded = await _sync_loaded_session(flow, session_id)

        detail = await _patch_exercises(
            flow, session_id, [loaded[1], _cleared_draft(loaded[0])]
        )

        assert _working_weights(detail["exercises"][1]) == [None] * _MATRIX_WORKING_SETS
        assert _working_weights(detail["exercises"][0]) == [_SQUAT_PLAN_WEIGHT] * _MATRIX_WORKING_SETS

    async def test_a_new_prefill_call_site_has_to_register_itself(self):
        """Guard: the table, not a promise, is what says the surface is covered.

        ``_apply_accepted_progression_targets`` is the only thing that writes an
        accepted target into a session, so its call sites *are* the entry points:
        a new way of seeding a session fails here until it is registered, which
        is also what gives it both states for free.
        """
        assert [entry.name for entry in PREFILL_ENTRY_POINTS] == [
            "template_start",
            "repeat_with_template",
            "repeat_without_template",
            "exercise_added_without_template",
            "exercise_added_with_template",
            "exercise_re_added_with_template",
        ]
        source = Path(workouts_service.__file__).read_text(encoding="utf-8")
        assert _prefill_call_sites(source) == {entry.path for entry in PREFILL_ENTRY_POINTS}


@pytest.mark.integration
class TestPrefillTargetsApi:
    """SPEC §58: one screen owns the accepted targets — prefill switch and edits."""

    # Kept as a method so the existing call sites read the same as before.
    _accepted_target = staticmethod(accepted_target)
    _slot_with_two_records = staticmethod(slot_with_two_records)

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

    async def test_a_combined_edit_is_one_transaction(self, flow: ProgressionFlow):
        """A rejected policy edit rolls the number back with it (SPEC §58)."""
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")

        failed = await flow.update_target(
            accepted["id"], {"value": 90, "reps_min": 15}
        )
        assert failed.status_code == 400, failed.text
        assert failed.json()["error"]["code"] == "progression_validation"

        # The value was written before the policy was rejected, yet it did not
        # survive: the whole edit is one transaction.
        listing = await flow.list_prefill(declined_only=False)
        item = next(entry for entry in listing["items"] if entry["id"] == accepted["id"])
        assert item["actual_selected_value"] == 82.5
        assert item["lifecycle_status"] == "accepted"
        policy = await flow.get_policy(BENCH_PRESS)
        assert policy["reps_min"] == 8 and policy["reps_max"] == 12

    async def test_a_combined_edit_rolls_back_on_a_write_failure(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """A failure on the policy write leaves the number as it was (SPEC §58)."""
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")

        from app.application.progression_engine_service import ProgressionEngineService
        from app.domain.exceptions import ProgressionValidationError

        async def boom(_self, **kwargs):
            raise ProgressionValidationError("simulated policy write failure")

        monkeypatch.setattr(ProgressionEngineService, "_apply_target_policy", boom)

        failed = await flow.update_target(
            accepted["id"], {"value": 90, "type": "LINEAR"}
        )
        assert failed.status_code == 400, failed.text

        listing = await flow.list_prefill(declined_only=False)
        item = next(entry for entry in listing["items"] if entry["id"] == accepted["id"])
        assert item["actual_selected_value"] == 82.5
        assert item["lifecycle_status"] == "accepted"
        assert item["effective_policy"] == "DOUBLE_PROGRESSION"

    async def test_an_empty_edit_is_rejected(self, flow: ProgressionFlow):
        _, accepted = await self._accepted_target(flow, name="Monday 3x8-12")
        response = await flow.update_target(accepted["id"], {})
        assert response.status_code == 400, response.text
        assert response.json()["error"]["code"] == "progression_validation"

    async def test_editing_an_unknown_target_returns_404(self, flow: ProgressionFlow):
        assert (await flow.update_target(999999, {"value": 80})).status_code == 404

    async def test_editing_a_superseded_target_is_refused(self, flow: ProgressionFlow):
        """A stale id is not a way into its slot — the answer names the current one."""
        superseded, newer = await self._slot_with_two_records(flow)

        stale = await flow.update_target(superseded["id"], {"value": 90})
        assert stale.status_code == 409, stale.text
        error = stale.json()["error"]
        assert error["code"] == "progression_target_superseded"
        assert error["details"]["recommendation_id"] == superseded["id"]
        assert error["details"]["superseded_by"] == newer["id"]

        # Nothing moved, and the id the error named really is the editable one.
        listing = await flow.list_prefill(declined_only=False)
        assert [item["id"] for item in listing["items"]] == [newer["id"]]
        assert listing["items"][0]["actual_selected_value"] != 90
        current = await flow.update_target(newer["id"], {"value": 90})
        assert current.status_code == 200, current.text
        assert current.json()["actual_selected_value"] == 90

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

    async def test_toggling_a_superseded_target_is_refused(
        self, flow: ProgressionFlow, db_session
    ):
        """A stale id is not a way into its slot's switch either, in both directions."""
        superseded, newer = await self._slot_with_two_records(flow)

        # Both switches answer with the slot's owner instead of quietly flipping a
        # row the screen no longer shows: off would be an invisible write, on an
        # invisible nothing.
        for call in (flow.disable_prefill, flow.enable_prefill):
            refused = await call(superseded["id"])
            assert refused.status_code == 409, refused.text
            error = refused.json()["error"]
            assert error["code"] == "progression_target_superseded"
            assert error["details"]["recommendation_id"] == superseded["id"]
            assert error["details"]["superseded_by"] == newer["id"]

        # Nothing moved on the stale record, and the id it names works.
        stale = await db_session.get(ProgressionRecommendationRecord, superseded["id"])
        await db_session.refresh(stale)
        assert stale.prefill_declined_at is None
        assert [
            item["id"] for item in (await flow.list_prefill(declined_only=False))["items"]
        ] == [newer["id"]]
        current = await flow.disable_prefill(newer["id"])
        assert current.status_code == 200, current.text
        assert current.json()["prefill_declined"] is True

    async def test_enabling_a_switched_off_superseded_target_is_refused(
        self, flow: ProgressionFlow, db_session
    ):
        """The mirror case: a stale row that is switched off stays off, with a reason."""
        template_id, first = await accepted_target(flow, name="Monday 3x8-12")
        assert (await flow.disable_prefill(first["id"])).status_code == 200
        # A second cycle in the same slot makes that switch a stale row's switch.
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
        assert (await flow.accept(newer["id"])).status_code == 200

        refused = await flow.enable_prefill(first["id"])
        assert refused.status_code == 409, refused.text
        assert refused.json()["error"]["details"]["superseded_by"] == newer["id"]
        stale = await db_session.get(ProgressionRecommendationRecord, first["id"])
        await db_session.refresh(stale)
        assert stale.prefill_declined_at is not None

        # The switch the user means is the one on the row the screen shows.
        assert (await flow.enable_prefill(newer["id"])).status_code == 200


@pytest.mark.integration
class TestPrefillBulkApi:
    """SPEC §58: bulk actions — one tap instead of walking the list row by row."""

    _slot_with_two_records = staticmethod(slot_with_two_records)

    @staticmethod
    @staticmethod
    async def _as_pre_carry_rows(
        db_session,
        *,
        replaced_id: int,
        carried_id: int,
        sweep_id: str,
    ) -> None:
        """Reshape two rows the way they were written before the refusal travelled.

        ``carry_prefill_consent`` hands the refusal and the sweep stamp to the
        target that replaces a switched-off one, so a sweep left holding replaced
        rows only exists in data written earlier. Restoring that shape is what keeps
        the journal's behaviour for it covered: such an entry must be listed and
        explained rather than disappear with a stamp nobody can act on.
        """
        replaced = await db_session.get(ProgressionRecommendationRecord, int(replaced_id))
        carried = await db_session.get(ProgressionRecommendationRecord, int(carried_id))
        # The stamp stayed behind on the replaced row, and the new target started
        # substituting again — the shape the carry exists to prevent.
        replaced.prefill_sweep_id = sweep_id
        carried.prefill_declined_at = None
        carried.prefill_sweep_id = None
        await db_session.commit()

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
        body = response.json()
        assert body["updated"] == 2 and body["applied_to_all"] is True
        assert body["skipped"] == []
        # The response names what it changed, not what was requested — that set is
        # what an undo hands back.
        assert sorted(body["changed_ids"]) == sorted(item["id"] for item in items)

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

    async def test_bulk_disable_refuses_a_superseded_id(
        self, flow: ProgressionFlow, db_session
    ):
        """A stale id is not switched — the slot answers with the goal that owns it."""
        superseded, newer = await self._slot_with_two_records(flow)

        response = await flow.bulk_disable_prefill([superseded["id"], newer["id"]])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["updated"] == 1 and body["changed_ids"] == [newer["id"]]
        assert [entry["recommendation_id"] for entry in body["skipped"]] == [
            superseded["id"]
        ]
        entry = body["skipped"][0]
        assert entry["reason"] == "superseded"
        assert entry["superseded_by"] == newer["id"]

        # The stale row still exists, so the report names it like a row of the list
        # instead of leaving the user with a bare id.
        stale = await db_session.get(ProgressionRecommendationRecord, superseded["id"])
        await db_session.refresh(stale)
        assert entry["exercise_name"] == "Seed Exercise 1"
        assert entry["value"] == float(stale.actual_selected_value)
        assert entry["unit"] == "kg"
        assert entry["scope_key"] == stale.scope_key
        # The slot is off once, through its own target — the old record was not
        # quietly switched as a second time.
        assert stale.prefill_declined_at is None
        assert [
            item["id"] for item in (await flow.list_prefill(declined_only=True))["items"]
        ] == [newer["id"]]

    async def test_undo_reports_a_superseded_target_with_its_owner(
        self, flow: ProgressionFlow, db_session
    ):
        """A sweep that only still holds a replaced record switches nothing on."""
        template_id, swept = await accepted_target(flow, name="Monday 3x8-12")
        assert (await flow.bulk_disable_prefill()).json()["changed_ids"] == [swept["id"]]
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        # A second cycle in the same slot replaces the swept record, which stays
        # switched off — so the sweep's address resolves to a stale row.
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
        assert newer["id"] != swept["id"]
        assert (await flow.accept(newer["id"])).status_code == 200
        # The refusal now travels with the slot, so a sweep can only end up holding
        # a replaced row in data written before that: rebuild that shape.
        await self._as_pre_carry_rows(
            db_session,
            replaced_id=swept["id"],
            carried_id=newer["id"],
            sweep_id=sweep_id,
        )

        body = (await flow.bulk_enable_sweeps([sweep_id])).json()
        assert body["updated"] == 0 and body["changed_ids"] == []
        assert [entry["recommendation_id"] for entry in body["skipped"]] == [swept["id"]]
        entry = body["skipped"][0]
        assert entry["reason"] == "superseded"
        assert entry["superseded_by"] == newer["id"]
        # The member that can never come back is released from the sweep in the
        # same transaction, so the entry stops holding a goal no undo can restore.
        assert body["released_ids"] == [swept["id"]]

        stale = await db_session.get(ProgressionRecommendationRecord, swept["id"])
        await db_session.refresh(stale)
        # Only the stamp went: the target stays switched off, because that decision
        # belongs to it and is not the one being undone here.
        assert stale.prefill_declined_at is not None
        assert stale.prefill_sweep_id is None
        # Nothing was promised back, and nothing is left to be offered either.
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}
        assert [
            item["id"] for item in (await flow.list_prefill(declined_only=False))["items"]
        ] == [newer["id"]]

    async def test_bulk_disable_with_selected_ids_leaves_the_rest_on(
        self, flow: ProgressionFlow
    ):
        monday, friday, items = await self._two_targets(flow)
        chosen = next(item for item in items if item["template_id"] == monday)

        response = await flow.bulk_disable_prefill([chosen["id"]])
        assert response.status_code == 200, response.text
        assert response.json() == {
            "updated": 1,
            "changed_ids": [chosen["id"]],
            "skipped": [],
            "released_ids": [],
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

    async def test_undo_restores_exactly_the_targets_the_action_switched_off(
        self, flow: ProgressionFlow
    ):
        """Undo replays the action's own changed set — not everything that is off."""
        monday, friday, items = await self._two_targets(flow)
        by_template = {item["template_id"]: item for item in items}
        swept = by_template[monday]
        earlier_off = by_template[friday]
        # Switched off before the sweep, by its own switch.
        assert (await flow.disable_prefill(earlier_off["id"])).status_code == 200

        body = (await flow.bulk_disable_prefill([swept["id"]])).json()
        assert body["changed_ids"] == [swept["id"]]

        undone = await flow.bulk_enable_prefill(body["changed_ids"])
        assert undone.status_code == 200, undone.text
        assert undone.json() == {
            "updated": 1,
            "changed_ids": [swept["id"]],
            "skipped": [],
            "released_ids": [],
            "applied_to_all": False,
        }

        # Only the undone target substitutes again; the earlier decision stands.
        listing = await flow.list_prefill(declined_only=True)
        assert [item["id"] for item in listing["items"]] == [earlier_off["id"]]
        back_on = await flow.session_exercise(await flow.start(monday))
        assert [item["weight"] for item in back_on["sets_completed"]] == [82.5, 82.5, 82.5]
        still_off = await flow.session_exercise(await flow.start(friday))
        assert [item["weight"] for item in still_off["sets_completed"]] == [60, 60, 60]

    async def test_undo_restores_a_template_less_target_too(self, flow: ProgressionFlow):
        """The user + exercise scope prefills again after an undo, like any other."""
        await flow.set_policy(BENCH_PRESS, increment=2.5, reps_min=8, reps_max=12)
        session_id = await flow.start()
        completed = await flow.complete(
            session_id,
            [
                {
                    "exercise_id": BENCH_PRESS,
                    "name": "Bench Press",
                    "sets_completed": _sets([12, 12, 12], weight=75),
                }
            ],
        )
        recommendation = completed["progression_recommendations"][0]
        assert ":t" not in recommendation["scope_key"]
        assert (await flow.accept(recommendation["id"])).status_code == 200

        body = (await flow.bulk_disable_prefill()).json()
        assert body["changed_ids"] == [recommendation["id"]]
        plan = await flow.repeat(session_id)
        sets = (await flow.session_exercise(plan["id"]))["sets_completed"]
        assert [item["weight"] for item in sets] == [75, 75, 75]

        undone = await flow.bulk_enable_prefill(body["changed_ids"])
        assert undone.status_code == 200, undone.text
        assert undone.json()["updated"] == 1
        back = await flow.repeat(session_id)
        sets = (await flow.session_exercise(back["id"]))["sets_completed"]
        assert [item["weight"] for item in sets] == [77.5, 77.5, 77.5]

    async def test_undo_reports_targets_whose_prefill_was_already_on(
        self, flow: ProgressionFlow
    ):
        """An undo is idempotent, and says which goals it found already on."""
        _, _, items = await self._two_targets(flow)
        ids = [item["id"] for item in items]
        assert sorted((await flow.bulk_disable_prefill(ids)).json()["changed_ids"]) == sorted(ids)
        assert (await flow.bulk_enable_prefill(ids)).json()["updated"] == 2

        body = (await flow.bulk_enable_prefill(ids)).json()
        assert body["updated"] == 0 and body["changed_ids"] == []
        assert body["applied_to_all"] is False
        assert [entry["recommendation_id"] for entry in body["skipped"]] == ids
        for entry, item in zip(body["skipped"], items, strict=True):
            assert entry["reason"] == "already_enabled"
            assert entry["exercise_name"] == "Seed Exercise 1"
            assert entry["value"] == item["actual_selected_value"]
            assert entry["unit"] == "kg"
            assert entry["scope_key"] == item["scope_key"]

    async def test_undo_reports_ids_that_are_no_longer_targets(self, flow: ProgressionFlow):
        """An undo of a stale set switches back on only what is still a target."""
        _, _, items = await self._two_targets(flow)
        kept, rejected = items[0]["id"], items[1]["id"]
        assert (await flow.bulk_disable_prefill([kept, rejected])).json()["updated"] == 2
        assert (await flow.reject(rejected)).status_code == 200

        body = (await flow.bulk_enable_prefill([kept, rejected, 999999])).json()
        assert body["updated"] == 1 and body["changed_ids"] == [kept]
        assert [entry["recommendation_id"] for entry in body["skipped"]] == [
            rejected,
            999999,
        ]
        assert {entry["reason"] for entry in body["skipped"]} == {"not_found"}
        # Nothing is left to name: the ids are all the user can be shown.
        assert all(entry["exercise_name"] is None for entry in body["skipped"])
        assert [item["id"] for item in (await flow.list_prefill(declined_only=True))["items"]] == []

    async def test_undo_requires_ids(self, flow: ProgressionFlow):
        """There is no «всем» form: switching the prefill on is a specific answer."""
        await self._two_targets(flow)
        assert (await flow.bulk_enable_prefill([])).status_code == 422
        no_body = await flow.client.post("/api/v1/progression/prefill/bulk-enable", json={})
        assert no_body.status_code == 422

    async def test_undo_needs_exactly_one_address(self, flow: ProgressionFlow):
        """Targets or sweeps, never both: the two would contradict each other."""
        _, _, items = await self._two_targets(flow)
        swept = (await flow.bulk_disable_prefill()).json()["changed_ids"]
        assert swept
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        both = await flow.client.post(
            "/api/v1/progression/prefill/bulk-enable",
            json={"recommendation_ids": [items[0]["id"]], "sweep_ids": [sweep_id]},
        )
        assert both.status_code == 422, both.text
        empty_sweeps = await flow.bulk_enable_sweeps([])
        assert empty_sweeps.status_code == 422, empty_sweeps.text

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
            "changed_ids": [chosen["id"]],
            "skipped": [],
            "released_ids": [],
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

    async def test_bulk_update_collapses_a_slot_to_its_current_target(
        self, flow: ProgressionFlow, monkeypatch, db_session
    ):
        """A policy belongs to the scope: the overlap is edited once, and explained."""
        from app.domain.progression_recommendation import (
            ProgressionRecommendationRecord,
        )

        superseded, newer = await self._slot_with_two_records(flow)
        # The premise: two records of one slot, both still accepted targets.
        older = await db_session.get(ProgressionRecommendationRecord, superseded["id"])
        current = await db_session.get(ProgressionRecommendationRecord, newer["id"])
        assert older.scope_key == current.scope_key
        assert older.lifecycle_status == "accepted"
        assert older.actual_selected_value is not None

        from app.infrastructure.repositories.progression_repository import (
            ProgressionRepository,
        )

        written: list[str] = []
        original = ProgressionRepository.upsert_policy

        async def counting_upsert(_self, *, user_id, scope, values, commit=True):
            written.append(scope.key)
            return await original(
                _self, user_id=user_id, scope=scope, values=values, commit=commit
            )

        monkeypatch.setattr(ProgressionRepository, "upsert_policy", counting_upsert)

        response = await flow.bulk_update_targets(
            [superseded["id"], newer["id"]],
            {"type": "LINEAR", "reps_min": 5, "reps_max": 8},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["updated"] == 1
        # The row the screen lists takes the edit; the hidden overlap is named, so
        # the report still reads like the list, but never as a second changed id.
        assert body["changed_ids"] == [newer["id"]]
        assert [entry["reason"] for entry in body["skipped"]] == ["superseded"]
        overlap = body["skipped"][0]
        assert overlap["recommendation_id"] == superseded["id"]
        # The pointer: this is the target to address for that slot from now on.
        assert overlap["superseded_by"] == newer["id"]
        assert overlap["exercise_id"] == BENCH_PRESS
        assert overlap["exercise_name"]
        assert overlap["value"] is not None and overlap["unit"] == "kg"
        # One policy write for the slot, however many records of it were selected.
        assert len(written) == 1

        listing = await flow.list_prefill(declined_only=False)
        assert listing["total"] == 1
        row = listing["items"][0]
        assert row["id"] == newer["id"]
        # The skipped overlap is named the same way the surviving row is.
        assert overlap["exercise_name"] == row["exercise_name"]
        assert row["effective_policy"] == "LINEAR"
        assert row["reps_min"] == 5 and row["reps_max"] == 8
        own = await flow.get_policy(
            BENCH_PRESS,
            template_id=row["template_id"],
            template_exercise_id=row["template_exercise_id"],
        )
        assert own["type"] == "LINEAR" and own["increment"] == 2.5
        # The user-level policy the program inherited is untouched.
        inherited = await flow.get_policy(BENCH_PRESS)
        assert inherited["type"] == "DOUBLE_PROGRESSION"
        assert inherited["reps_min"] == 8 and inherited["reps_max"] == 12

    async def test_bulk_update_refuses_a_superseded_record(
        self, flow: ProgressionFlow
    ):
        """A stale id edits nothing — the slot answers with what owns it now.

        The record exists and is accepted, so it is not ``not_found``; it is simply
        not the goal of its slot anymore, and a policy belongs to the scope.
        """
        superseded, newer = await self._slot_with_two_records(flow)
        response = await flow.bulk_update_targets([superseded["id"]], {"type": "LINEAR"})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["updated"] == 0 and body["changed_ids"] == []
        assert [entry["reason"] for entry in body["skipped"]] == ["superseded"]
        assert body["skipped"][0]["superseded_by"] == newer["id"]

        # The slot's plan is exactly as it was, and no own policy row appeared.
        listing = await flow.list_prefill(declined_only=False)
        assert [item["id"] for item in listing["items"]] == [newer["id"]]
        row = listing["items"][0]
        assert row["effective_policy"] == "DOUBLE_PROGRESSION"
        own = await flow.get_policy(
            BENCH_PRESS,
            template_id=row["template_id"],
            template_exercise_id=row["template_exercise_id"],
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
            "changed_ids": [items[0]["id"]],
            "skipped": [
                {
                    "recommendation_id": 999999,
                    "reason": "not_found",
                    "superseded_by": None,
                    "exercise_id": None,
                    "exercise_name": None,
                    "value": None,
                    "unit": None,
                    "scope_key": None,
                }
            ],
            "released_ids": [],
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

        # An undo cannot reach them either: a foreign id is simply not a target.
        enabled = await client.post(
            "/api/v1/progression/prefill/bulk-enable",
            json={"recommendation_ids": ids},
            headers=headers,
        )
        assert enabled.status_code == 200, enabled.text
        assert enabled.json()["updated"] == 0
        assert {entry["reason"] for entry in enabled.json()["skipped"]} == {"not_found"}

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

    # ─── the sweeps live on the server (SPEC §58) ───────────────────────────

    async def test_sweeps_offer_the_bulk_switch_offs_for_undo(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)

        # Nothing was switched off in bulk yet, so there is nothing to come back to.
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}

        assert (await flow.bulk_disable_prefill()).status_code == 200
        body = await flow.prefill_sweeps()
        assert body["total"] == 1
        sweep = body["sweeps"][0]
        # The undo is resolved from the data the sweep left behind, so it does not
        # depend on the caller still holding the previous response.
        assert sweep["sweep_id"]
        assert sweep["declined_at"] is not None
        assert sweep["updated"] == 2
        assert sorted(sweep["changed_ids"]) == ids

        undone = await flow.bulk_enable_prefill(sweep["changed_ids"])
        assert undone.status_code == 200 and undone.json()["updated"] == 2
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}

    async def test_sweeps_lists_the_whole_chain_newest_first(
        self, flow: ProgressionFlow
    ):
        """A run of bulk actions is addressable link by link, not only its last one."""
        _, monday_target = await accepted_target(flow, name="Monday 3x8-12")
        first = (await flow.bulk_disable_prefill()).json()
        assert first["changed_ids"] == [monday_target["id"]]

        # A second scope joins the list, and the next sweep only changes it.
        await accepted_target(flow, name="Friday 3x8-12", weight=60)
        second = (await flow.bulk_disable_prefill()).json()
        assert len(second["changed_ids"]) == 1

        body = await flow.prefill_sweeps()
        assert body["total"] == 2
        sweeps = body["sweeps"]
        assert sweeps[0]["changed_ids"] == second["changed_ids"]
        assert sweeps[1]["changed_ids"] == first["changed_ids"]
        assert sweeps[0]["sweep_id"] != sweeps[1]["sweep_id"]

        # Any link can be undone, not just the newest: putting the older sweep
        # back leaves the newer one in place and offered.
        assert (
            await flow.bulk_enable_prefill(sweeps[1]["changed_ids"])
        ).json()["updated"] == 1
        remaining = (await flow.prefill_sweeps())["sweeps"]
        assert [sweep["changed_ids"] for sweep in remaining] == [second["changed_ids"]]

    async def test_sweeps_are_limited_and_newest_first(self, flow: ProgressionFlow):
        # Three sweeps over the same scope is not possible (a target is switched
        # off once), so the chain is built from three separate scopes: each sweep
        # changes the targets of one scope, in order.
        for index, name in enumerate(("Monday 3x8-12", "Friday 3x8-12", "Sunday 3x8-12")):
            await accepted_target(flow, name=name, weight=60 + index)
            assert (await flow.bulk_disable_prefill()).json()["updated"] == 1

        assert (await flow.prefill_sweeps())["total"] == 3
        limited = await flow.prefill_sweeps(limit=2)
        assert limited["total"] == 2
        newest = (await flow.prefill_sweeps())["sweeps"]
        assert limited["sweeps"][0]["sweep_id"] == newest[0]["sweep_id"]
        assert limited["sweeps"][1]["sweep_id"] == newest[1]["sweep_id"]

    async def test_a_single_flip_is_not_a_sweep(self, flow: ProgressionFlow):
        """Only a bulk action is undoable in bulk; a row switch is one decision."""
        _, _, items = await self._two_targets(flow)
        assert (await flow.disable_prefill(items[0]["id"])).status_code == 200

        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}

    async def test_a_sweep_shrinks_when_a_target_is_switched_on_by_hand(
        self, flow: ProgressionFlow
    ):
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)
        assert (await flow.bulk_disable_prefill()).status_code == 200

        assert (await flow.enable_prefill(ids[0])).status_code == 200
        assert (await flow.prefill_sweeps())["sweeps"][0]["changed_ids"] == [ids[1]]

        # Switching the last one on leaves a sweep with nothing in it, so the
        # server stops offering an undo instead of promising an empty one.
        assert (await flow.enable_prefill(ids[1])).status_code == 200
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}

    async def test_a_sweep_left_with_replaced_members_says_so(
        self, flow: ProgressionFlow, db_session
    ):
        """The action stays visible with its stamp, instead of vanishing with it."""
        template_id, old = await accepted_target(flow, name="Monday 3x8-12")
        assert (await flow.bulk_disable_prefill()).json()["changed_ids"] == [old["id"]]
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        # A second cycle in the same slot replaces the swept target, so it is no
        # longer the scope's goal and can never come back through this sweep.
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
        assert (await flow.accept(newer["id"])).status_code == 200

        # Rows written before the refusal started travelling with the slot look like
        # this: the entry must still be listed and explained, not disappear.
        await self._as_pre_carry_rows(
            db_session,
            replaced_id=old["id"],
            carried_id=newer["id"],
            sweep_id=sweep_id,
        )

        body = await flow.prefill_sweeps()
        assert body["total"] == 1
        sweep = body["sweeps"][0]
        assert sweep["restorable"] is False
        assert sweep["updated"] == 0 and sweep["changed_ids"] == []
        assert sweep["superseded"] == [
            {"recommendation_id": old["id"], "superseded_by": newer["id"]}
        ]

    async def test_a_sweep_holding_both_kinds_brings_back_only_what_it_can(
        self, flow: ProgressionFlow, db_session
    ):
        """One entry, two answers: what comes back, and what never can."""
        template_id, monday = await accepted_target(flow, name="Monday 3x8-12")
        _, friday = await accepted_target(flow, name="Friday 3x8-12", weight=60)
        both = (await flow.bulk_disable_prefill()).json()
        assert sorted(both["changed_ids"]) == sorted([monday["id"], friday["id"]])
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        # Only one of the two slots moves on, so the sweep ends up half reachable.
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
        assert (await flow.accept(newer["id"])).status_code == 200

        # A pair written before the refusal travelled with the slot: the stamp
        # stayed behind on the replaced row, which makes this entry half spent.
        await self._as_pre_carry_rows(
            db_session,
            replaced_id=monday["id"],
            carried_id=newer["id"],
            sweep_id=sweep_id,
        )

        sweep = (await flow.prefill_sweeps())["sweeps"][0]
        assert sweep["restorable"] is True
        assert sweep["updated"] == 1 and sweep["changed_ids"] == [friday["id"]]
        assert sweep["superseded"] == [
            {"recommendation_id": monday["id"], "superseded_by": newer["id"]}
        ]

        body = (await flow.bulk_enable_sweeps([sweep_id])).json()
        assert body["changed_ids"] == [friday["id"]]
        assert [entry["recommendation_id"] for entry in body["skipped"]] == [monday["id"]]
        assert body["skipped"][0]["reason"] == "superseded"
        assert body["released_ids"] == [monday["id"]]

        # The chain is spent: the reachable goal is on, the replaced one is released
        # and stays off — the journal has nothing left to offer.
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}
        stale = await db_session.get(ProgressionRecommendationRecord, monday["id"])
        await db_session.refresh(stale)
        assert stale.prefill_declined_at is not None
        assert stale.prefill_sweep_id is None

    async def test_a_sweep_stays_alive_through_the_target_that_replaced_it(
        self, flow: ProgressionFlow, db_session
    ):
        """A training cycle does not end a decision made about the slot (§58)."""
        template_id, swept = await accepted_target(flow, name="Monday 3x8-12")
        assert (await flow.bulk_disable_prefill()).json()["changed_ids"] == [swept["id"]]
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        # A second cycle in the same slot: the target that takes over inherits the
        # refusal *and* the sweep it was made in, so the way back stays actionable.
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
        assert (await flow.accept(newer["id"])).status_code == 200

        replaced = await db_session.get(ProgressionRecommendationRecord, swept["id"])
        await db_session.refresh(replaced)
        carried = await db_session.get(ProgressionRecommendationRecord, newer["id"])
        await db_session.refresh(carried)
        assert carried.prefill_sweep_id == sweep_id
        # The original moment travels too, so the journal still dates the decision
        # instead of quietly re-dating it to the cycle that replaced the row.
        assert carried.prefill_declined_at == replaced.prefill_declined_at
        # The replaced row keeps the decision itself and stops holding the sweep:
        # nothing can switch it back on through that sweep anyway.
        assert replaced.prefill_declined_at is not None
        assert replaced.prefill_sweep_id is None

        sweep = (await flow.prefill_sweeps())["sweeps"][0]
        assert sweep["sweep_id"] == sweep_id
        assert sweep["restorable"] is True
        assert sweep["changed_ids"] == [newer["id"]]
        assert sweep["superseded"] == []

        # The undo really puts the substitution back — on the goal that owns the
        # slot now, which is the one a new session would prefill from.
        undone = (await flow.bulk_enable_sweeps([sweep_id])).json()
        assert undone["changed_ids"] == [newer["id"]]
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}
        exercise = await flow.session_exercise(await flow.start(template_id))
        assert [item["weight"] for item in exercise["sets_completed"]] == [85.0, 85.0, 85.0]

    async def test_rejecting_the_target_that_inherited_a_sweep_does_not_strand_it(
        self, flow: ProgressionFlow, db_session
    ):
        """A rejected goal cannot prefill, so it must not keep holding a sweep."""
        template_id, swept = await accepted_target(flow, name="Monday 3x8-12")
        assert (await flow.bulk_disable_prefill()).json()["changed_ids"] == [swept["id"]]
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

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
        assert (await flow.accept(newer["id"])).status_code == 200
        carried = await db_session.get(ProgressionRecommendationRecord, newer["id"])
        await db_session.refresh(carried)
        assert carried.prefill_sweep_id == sweep_id

        assert (await flow.reject(newer["id"])).status_code == 200

        rejected = await db_session.get(ProgressionRecommendationRecord, newer["id"])
        await db_session.refresh(rejected)
        # Nothing is left holding the sweep on a row no undo can act on, and the
        # slot's own refusal stays with the goal that owns it now — switched off,
        # and visible on the settings screen where it can be turned back on.
        assert rejected.prefill_sweep_id is None
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}
        assert [
            item["id"] for item in (await flow.list_prefill(declined_only=True))["items"]
        ] == [swept["id"]]

    async def test_the_whole_chain_comes_back_in_one_call(self, flow: ProgressionFlow):
        """«Вернуть всё» is one request, however long the chain is."""
        expected: list[int] = []
        for index, name in enumerate(("Monday 3x8-12", "Friday 3x8-12", "Sunday 3x8-12")):
            await accepted_target(flow, name=name, weight=60 + index)
            expected += (await flow.bulk_disable_prefill()).json()["changed_ids"]

        sweeps = (await flow.prefill_sweeps())["sweeps"]
        assert len(sweeps) == 3

        response = await flow.bulk_enable_sweeps([sweep["sweep_id"] for sweep in sweeps])
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["updated"] == 3
        assert sorted(body["changed_ids"]) == sorted(expected)
        assert body["skipped"] == []

        # The chain is spent: nothing is left to undo, and the list prefills again.
        assert await flow.prefill_sweeps() == {"sweeps": [], "total": 0}
        listing = await flow.list_prefill(declined_only=False)
        assert all(item["prefill_declined"] is False for item in listing["items"])

    async def test_a_sweep_address_undoes_only_that_sweep(self, flow: ProgressionFlow):
        _, monday_target = await accepted_target(flow, name="Monday 3x8-12")
        first = (await flow.bulk_disable_prefill()).json()
        await accepted_target(flow, name="Friday 3x8-12", weight=60)
        second = (await flow.bulk_disable_prefill()).json()
        older = next(
            sweep
            for sweep in (await flow.prefill_sweeps())["sweeps"]
            if sweep["changed_ids"] == first["changed_ids"]
        )

        response = await flow.bulk_enable_sweeps([older["sweep_id"]])
        assert response.status_code == 200, response.text
        assert response.json()["changed_ids"] == [monday_target["id"]]

        # The newer link was not in the address, so it stays offered — and the
        # older one is gone from the chain because it has nothing left.
        remaining = (await flow.prefill_sweeps())["sweeps"]
        assert [sweep["changed_ids"] for sweep in remaining] == [second["changed_ids"]]

    async def test_a_sweep_address_ignores_unknown_and_foreign_sweeps(
        self, flow: ProgressionFlow, client: AsyncClient
    ):
        _, _, items = await self._two_targets(flow)
        assert (await flow.bulk_disable_prefill()).status_code == 200
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        unknown = await flow.bulk_enable_sweeps(["00000000-0000-0000-0000-000000000000"])
        assert unknown.status_code == 200, unknown.text
        assert unknown.json()["updated"] == 0 and unknown.json()["skipped"] == []

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
        foreign = await client.post(
            "/api/v1/progression/prefill/bulk-enable",
            json={"sweep_ids": [sweep_id]},
            headers=headers,
        )
        assert foreign.status_code == 200, foreign.text
        assert foreign.json()["updated"] == 0

        # Neither miss touched anything: the sweep is still exactly what it was.
        mine = (await flow.prefill_sweeps())["sweeps"]
        assert len(mine) == 1
        assert sorted(mine[0]["changed_ids"]) == sorted(item["id"] for item in items)

    async def test_a_repeated_sweep_undo_reports_nothing_to_change(
        self, flow: ProgressionFlow
    ):
        _, _, _ = await self._two_targets(flow)
        await flow.bulk_disable_prefill()
        sweep_id = (await flow.prefill_sweeps())["sweeps"][0]["sweep_id"]

        first = await flow.bulk_enable_sweeps([sweep_id])
        assert first.status_code == 200 and first.json()["updated"] == 2

        # The sweep has nothing switched off any more, so it resolves to no
        # targets: there is nothing to report, and nothing was rewritten.
        again = await flow.bulk_enable_sweeps([sweep_id])
        assert again.status_code == 200, again.text
        assert again.json() == {
            "updated": 0,
            "changed_ids": [],
            "skipped": [],
            "released_ids": [],
            "applied_to_all": False,
        }
        assert all(
            item["prefill_declined"] is False
            for item in (await flow.list_prefill(declined_only=False))["items"]
        )

    async def test_sweeps_are_scoped_to_the_user(
        self, flow: ProgressionFlow, client: AsyncClient
    ):
        _, _, items = await self._two_targets(flow)
        assert (await flow.bulk_disable_prefill()).status_code == 200

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

        # Another user has no sweeps of their own and cannot undo ours through this
        # window: the ids never leave the user's own data.
        other = await client.get(
            "/api/v1/progression/prefill/sweeps", headers=headers
        )
        assert other.status_code == 200, other.text
        assert other.json() == {"sweeps": [], "total": 0}
        mine = (await flow.prefill_sweeps())["sweeps"]
        assert sorted(mine[0]["changed_ids"]) == sorted(item["id"] for item in items)

    # ─── bulk actions are one transaction (SPEC §58) ────────────────────────

    async def test_bulk_policy_edit_is_one_transaction(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """A failure while writing one target leaves the whole selection untouched."""
        _, _, items = await self._two_targets(flow)
        ids = [item["id"] for item in items]

        from app.application.progression_engine_service import ProgressionEngineService
        from app.domain.exceptions import ProgressionValidationError

        original = ProgressionEngineService._apply_target_policy
        calls = {"n": 0}

        async def flaky(_self, **kwargs):
            calls["n"] += 1
            if calls["n"] == 2:
                raise ProgressionValidationError("simulated write failure")
            return await original(_self, **kwargs)

        monkeypatch.setattr(ProgressionEngineService, "_apply_target_policy", flaky)

        failed = await flow.bulk_update_targets(
            ids, {"type": "LINEAR", "reps_min": 5, "reps_max": 8}
        )
        assert failed.status_code == 400, failed.text
        assert calls["n"] == 2

        # The first target was written (flushed) before the second failed, yet the
        # roll-back left both of them exactly as they were — no half-edited sweep.
        by_id = {
            item["id"]: item
            for item in (await flow.list_prefill(declined_only=False))["items"]
        }
        for item_id in ids:
            target = by_id[item_id]
            assert target["effective_policy"] == "DOUBLE_PROGRESSION"
            assert target["reps_min"] == 8 and target["reps_max"] == 12
            own = await flow.get_policy(
                BENCH_PRESS,
                template_id=target["template_id"],
                template_exercise_id=target["template_exercise_id"],
            )
            # A materialized row would have been committed — it was not.
            assert own["policy_scope_key"] != own["scope_key"]

    async def test_bulk_switch_off_is_one_transaction(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """A partial write is rolled back, so no half of a sweep stays applied."""
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)

        from app.domain.exceptions import ProgressionValidationError
        from app.infrastructure.repositories.progression_repository import (
            ProgressionRepository,
        )

        original = ProgressionRepository.decline_prefill

        async def half_then_fail(
            _self, *, user_id, recommendation_ids, sweep_id=None, commit=True
        ):
            # Switch off only the first target, then fail before the commit.
            await original(
                _self,
                user_id=user_id,
                recommendation_ids=list(recommendation_ids)[:1],
                sweep_id=sweep_id,
                commit=False,
            )
            raise ProgressionValidationError("simulated write failure")

        monkeypatch.setattr(ProgressionRepository, "decline_prefill", half_then_fail)

        failed = await flow.bulk_disable_prefill(ids)
        assert failed.status_code == 400, failed.text

        # The single half-written target did not survive the roll-back.
        assert (await flow.list_prefill(declined_only=True))["items"] == []

    async def test_bulk_undo_is_one_transaction(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """A failure while putting the prefill back leaves every target still off."""
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)
        assert (await flow.bulk_disable_prefill()).json()["updated"] == 2

        from app.domain.exceptions import ProgressionValidationError
        from app.infrastructure.repositories.progression_repository import (
            ProgressionRepository,
        )

        original = ProgressionRepository.enable_prefill_bulk

        async def half_then_fail(_self, *, user_id, recommendation_ids, commit=True):
            await original(
                _self,
                user_id=user_id,
                recommendation_ids=list(recommendation_ids)[:1],
                commit=False,
            )
            raise ProgressionValidationError("simulated write failure")

        monkeypatch.setattr(
            ProgressionRepository, "enable_prefill_bulk", half_then_fail
        )

        failed = await flow.bulk_enable_prefill(ids)
        assert failed.status_code == 400, failed.text

        # The half-restored target is still switched off, and its sweep is intact.
        still_off = await flow.list_prefill(declined_only=True)
        assert sorted(item["id"] for item in still_off["items"]) == ids
        assert (await flow.prefill_sweeps())["total"] == 1

    async def test_bulk_changed_ids_are_the_rows_actually_written(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """A target a concurrent write already switched off is not promised."""
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)

        from app.infrastructure.repositories.progression_repository import (
            ProgressionRepository,
        )

        original = ProgressionRepository.decline_prefill

        async def racy(
            _self, *, user_id, recommendation_ids, sweep_id=None, commit=True
        ):
            targets = list(recommendation_ids)
            # Someone else switches the first target off before this call's UPDATE.
            await original(
                _self,
                user_id=user_id,
                recommendation_ids=targets[:1],
                sweep_id=None,
                commit=True,
            )
            return await original(
                _self,
                user_id=user_id,
                recommendation_ids=targets,
                sweep_id=sweep_id,
                commit=commit,
            )

        monkeypatch.setattr(ProgressionRepository, "decline_prefill", racy)

        body = (await flow.bulk_disable_prefill(ids)).json()
        # The response names the one row it really changed, not the two it asked for.
        assert body["updated"] == 1
        assert len(body["changed_ids"]) == 1
        # The raced target is explained rather than promised as undoable.
        assert [entry["reason"] for entry in body["skipped"]] == ["already_disabled"]
        assert body["skipped"][0]["recommendation_id"] not in body["changed_ids"]
        assert sorted(
            item["id"] for item in (await flow.list_prefill(declined_only=True))["items"]
        ) == ids

    async def test_undo_changed_ids_are_the_rows_actually_written(
        self, flow: ProgressionFlow, monkeypatch
    ):
        """An undo returns only the rows it really re-enabled, none of the raced one."""
        _, _, items = await self._two_targets(flow)
        ids = sorted(item["id"] for item in items)
        assert (await flow.bulk_disable_prefill()).json()["updated"] == 2

        from app.infrastructure.repositories.progression_repository import (
            ProgressionRepository,
        )

        original = ProgressionRepository.enable_prefill_bulk

        async def racy(_self, *, user_id, recommendation_ids, commit=True):
            targets = list(recommendation_ids)
            # Someone else re-enables the first target before this call's UPDATE.
            await original(
                _self, user_id=user_id, recommendation_ids=targets[:1], commit=True
            )
            return await original(
                _self, user_id=user_id, recommendation_ids=targets, commit=commit
            )

        monkeypatch.setattr(ProgressionRepository, "enable_prefill_bulk", racy)

        body = (await flow.bulk_enable_prefill(ids)).json()
        assert body["updated"] == 1
        assert len(body["changed_ids"]) == 1
        assert [entry["reason"] for entry in body["skipped"]] == ["already_enabled"]
        assert body["skipped"][0]["recommendation_id"] not in body["changed_ids"]
        # Both are on: the raced one through its own write, the other through this
        # call — but only the latter was promised by the response.
        assert (await flow.list_prefill(declined_only=True))["items"] == []
