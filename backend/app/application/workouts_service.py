from __future__ import annotations

import hashlib
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.session_metrics import compute_session_metrics
from app.core.audit import (
    WORKOUT_COMPLETE,
    WORKOUT_START,
    WORKOUT_TEMPLATE_ARCHIVE,
    WORKOUT_TEMPLATE_CREATE,
    WORKOUT_TEMPLATE_DELETE,
    WORKOUT_TEMPLATE_UNARCHIVE,
    WORKOUT_TEMPLATE_UPDATE,
    WORKOUT_UPDATE,
    audit_log,
)
from app.domain.exceptions import WorkoutConflictError, WorkoutNotFoundError
from app.domain.muscle_load import MuscleLoad
from app.domain.recovery_state import RecoveryState
from app.domain.template_exercise import TemplateExercise
from app.domain.training_load_daily import TrainingLoadDaily
from app.domain.workout_log import WorkoutLog
from app.domain.workout_session_exercise import WorkoutSessionExercise
from app.domain.workout_set import WorkoutSet
from app.domain.workout_template import WorkoutTemplate
from app.infrastructure.cache import invalidate_user_analytics_cache
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.workouts_repository import WorkoutsRepository
from app.schemas.enums import WorkoutSessionType, WorkoutSetType
from app.schemas.workouts import (
    CompletedExercise,
    ExerciseInTemplate,
    StartWorkoutTemplateOverrides,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    WorkoutSessionUpdateRequest,
    WorkoutStartFromTemplateRequest,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutTemplateCloneRequest,
    WorkoutTemplateCreate,
    WorkoutTemplateFromWorkoutCreate,
    WorkoutTemplateList,
    WorkoutTemplatePatchRequest,
    WorkoutTemplateResponse,
    WorkoutSessionMetrics,
    WorkoutSetPatchRequest,
    WorkoutSetResponse,
)
from app.settings import settings


class WorkoutsService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = WorkoutsRepository(db)

    async def get_weight_recommendation(
        self,
        user_id: int,
        workout_session_id: int,
        exercise_id: int,
    ) -> dict:
        """
        Возвращает рекомендацию по весу для следующего подхода на основе RPE последнего подхода.
        """
        last_set = await self.repository.get_last_set_for_exercise(user_id, workout_session_id, exercise_id)
        if not last_set or last_set.weight is None or last_set.rpe is None:
            return {"recommendation": "no_data", "message": "Нет данных для рекомендации"}

        weight = float(last_set.weight)
        rpe = float(last_set.rpe)
        if rpe < 7:
            new_weight = round(weight * 1.025, 2)
            return {
                "recommendation": "increase",
                "suggested_weight": new_weight,
                "message": f"RPE={rpe} (<7): Рекомендуется увеличить вес до {new_weight} кг",
            }
        if 7 <= rpe < 10:
            return {
                "recommendation": "keep",
                "suggested_weight": weight,
                "message": f"RPE={rpe} (7–9): Оставьте вес {weight} кг",
            }
        new_weight = round(weight * 0.975, 2)
        return {
            "recommendation": "decrease",
            "suggested_weight": new_weight,
            "message": f"RPE={rpe} (=10): Рекомендуется уменьшить вес до {new_weight} кг",
        }

    @staticmethod
    def _safe_float(value: object) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _extract_workout_volume_and_rpe(self, exercises: Optional[list[dict]]) -> tuple[float, list[float]]:
        if not exercises:
            return 0.0, []

        total_volume = 0.0
        rpe_values: list[float] = []
        for exercise in exercises:
            if not isinstance(exercise, dict):
                continue
            sets = exercise.get("sets_completed")
            if not isinstance(sets, list):
                continue
            for set_item in sets:
                if not isinstance(set_item, dict):
                    continue
                reps = self._safe_float(set_item.get("reps"))
                weight = self._safe_float(set_item.get("weight"))
                if reps is not None and weight is not None and reps >= 0 and weight >= 0:
                    total_volume += reps * weight
                rpe = self._safe_float(set_item.get("rpe"))
                if rpe is not None and 0 <= rpe <= 10:
                    rpe_values.append(rpe)
        return total_volume, rpe_values

    @staticmethod
    def _session_metrics_model(metrics: Optional[dict]) -> Optional[WorkoutSessionMetrics]:
        if not metrics:
            return None
        return WorkoutSessionMetrics.model_validate(metrics)

    def _extract_workout_muscle_load(
        self,
        exercises: Optional[list[dict]],
        exercise_groups_map: dict[int, list[str]],
    ) -> dict[str, float]:
        if not exercises:
            return {}

        muscle_load: dict[str, float] = {}
        for exercise in exercises:
            if not isinstance(exercise, dict):
                continue
            exercise_id_raw = exercise.get("exercise_id")
            if exercise_id_raw is None:
                continue
            try:
                exercise_id = int(exercise_id_raw)
            except (TypeError, ValueError):
                continue

            muscle_groups = [
                group for group in exercise_groups_map.get(exercise_id, []) if isinstance(group, str) and group
            ]
            if not muscle_groups:
                continue

            sets = exercise.get("sets_completed")
            if not isinstance(sets, list):
                continue
            for set_item in sets:
                if not isinstance(set_item, dict):
                    continue
                reps = self._safe_float(set_item.get("reps"))
                if reps is None or reps < 0:
                    continue
                weight = self._safe_float(set_item.get("weight"))
                set_load_score = reps * (weight if weight is not None and weight >= 0 else 1.0)
                if set_load_score <= 0:
                    continue
                share = set_load_score / len(muscle_groups)
                for muscle_group in muscle_groups:
                    muscle_load[muscle_group] = muscle_load.get(muscle_group, 0.0) + share
        return muscle_load

    @staticmethod
    def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
        return max(lower, min(upper, value))

    @staticmethod
    def _exercise_template_to_workout_draft(ex: dict, index: int) -> dict:
        sets = int(ex.get("sets") or 0)
        if sets < 1:
            sets = 1
        return {
            "exercise_id": ex.get("exercise_id"),
            "name": ex.get("name") or f"Exercise #{index + 1}",
            "notes": ex.get("notes"),
            "sets_completed": [
                {
                    "set_number": i + 1,
                    "set_type": WorkoutSetType.WORKING.value,
                    "reps": ex.get("reps"),
                    "weight": ex.get("weight"),
                    "planned_rest_seconds": ex.get("rest_seconds"),
                    "duration": ex.get("duration"),
                    "completed": False,
                }
                for i in range(sets)
            ],
        }

    @staticmethod
    def _parse_optional_datetime(value: object) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
                return datetime.fromisoformat(normalized)
            except ValueError:
                return None
        return None

    @staticmethod
    def _normalize_set_type(value: object) -> str:
        allowed = {item.value for item in WorkoutSetType}
        candidate = str(value).strip().lower() if value is not None else WorkoutSetType.WORKING.value
        return candidate if candidate in allowed else WorkoutSetType.WORKING.value

    def _build_template_exercise_rows(
        self,
        *,
        user_id: int,
        exercises_payload: list[dict],
    ) -> list[TemplateExercise]:
        rows: list[TemplateExercise] = []
        for idx, raw in enumerate(exercises_payload):
            rows.append(
                TemplateExercise(
                    user_id=user_id,
                    exercise_id=int(raw.get("exercise_id") or (idx + 1)),
                    order_index=idx,
                    name=str(raw.get("name") or f"Exercise #{idx + 1}").strip() or f"Exercise #{idx + 1}",
                    sets=max(int(raw.get("sets") or 1), 1),
                    reps=raw.get("reps"),
                    duration=raw.get("duration"),
                    rest_seconds=max(int(raw.get("rest_seconds") or 0), 0),
                    weight=raw.get("weight"),
                    notes=raw.get("notes"),
                )
            )
        return rows

    def _build_session_snapshot_rows(
        self,
        *,
        user_id: int,
        workout_session_id: int,
        exercises_payload: list[dict],
    ) -> list[WorkoutSessionExercise]:
        rows: list[WorkoutSessionExercise] = []
        for ex_idx, raw_exercise in enumerate(exercises_payload):
            session_exercise = WorkoutSessionExercise(
                user_id=user_id,
                workout_session_id=workout_session_id,
                exercise_id=int(raw_exercise.get("exercise_id") or (ex_idx + 1)),
                order_index=ex_idx,
                name=str(raw_exercise.get("name") or f"Exercise #{ex_idx + 1}").strip() or f"Exercise #{ex_idx + 1}",
                notes=raw_exercise.get("notes"),
            )
            sets_payload = raw_exercise.get("sets_completed") if isinstance(raw_exercise, dict) else None
            if isinstance(sets_payload, list):
                for set_idx, raw_set in enumerate(sets_payload):
                    if not isinstance(raw_set, dict):
                        continue
                    session_exercise.sets.append(
                        WorkoutSet(
                            user_id=user_id,
                            workout_session_id=workout_session_id,
                            set_number=int(raw_set.get("set_number") or set_idx + 1),
                            set_type=self._normalize_set_type(raw_set.get("set_type")),
                            reps=raw_set.get("reps"),
                            weight=raw_set.get("weight"),
                            rpe=raw_set.get("rpe"),
                            rir=raw_set.get("rir"),
                            planned_rest_seconds=raw_set.get("planned_rest_seconds"),
                            actual_rest_seconds=raw_set.get("actual_rest_seconds"),
                            rest_seconds=raw_set.get("rest_seconds"),
                            duration=raw_set.get("duration"),
                            speed_kmh=raw_set.get("speed_kmh"),
                            incline_pct=raw_set.get("incline_pct"),
                            started_at=WorkoutsService._parse_optional_datetime(raw_set.get("started_at")),
                            completed_at=WorkoutsService._parse_optional_datetime(raw_set.get("completed_at")),
                            completed=bool(raw_set.get("completed", True)),
                        )
                    )
            rows.append(session_exercise)
        return rows

    @staticmethod
    def _apply_reorder(existing: list[dict], order: list[int]) -> list[dict]:
        if len(existing) != len(order):
            raise WorkoutConflictError("exercise_order length must match existing exercises")
        if sorted(order) != list(range(len(existing))):
            raise WorkoutConflictError("exercise_order must be a full 0-based permutation")
        return [existing[idx] for idx in order]

    async def _build_clone_name(self, user_id: int, source_name: str) -> str:
        existing = {name.strip().lower() for name in await self.repository.list_template_names(user_id=user_id)}
        base = source_name.strip() or "Шаблон"
        candidate = f"{base} (копия)"
        if candidate.lower() not in existing:
            return candidate
        suffix = 2
        while f"{candidate} {suffix}".lower() in existing:
            suffix += 1
        return f"{candidate} {suffix}"

    def _resolve_start_overrides(
        self,
        template_exercises: list[dict],
        overrides: StartWorkoutTemplateOverrides | None,
    ) -> tuple[list[dict], str | None, list[str]]:
        source_exercises: list[dict]
        if overrides and overrides.exercises:
            source_exercises = [ex.model_dump(mode="json") for ex in overrides.exercises]
        else:
            source_exercises = template_exercises or []
        initial_exercises = [
            self._exercise_template_to_workout_draft(ex, idx) for idx, ex in enumerate(source_exercises)
        ]
        comments = overrides.comments if overrides else None
        tags = list(overrides.tags) if overrides else []
        return initial_exercises, comments, tags

    async def get_templates(
        self,
        user_id: int,
        page: int,
        page_size: int,
        template_type: Optional[str],
        include_archived: bool = False,
    ) -> WorkoutTemplateList:
        total = await self.repository.count_templates(
            user_id=user_id,
            template_type=template_type,
            include_archived=include_archived,
        )
        templates = await self.repository.list_templates(
            user_id=user_id,
            page=page,
            page_size=page_size,
            template_type=template_type,
            include_archived=include_archived,
        )
        return WorkoutTemplateList(
            items=[WorkoutTemplateResponse.model_validate(t, from_attributes=True) for t in templates],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def create_template(
        self,
        user_id: int,
        data: WorkoutTemplateCreate,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        template = WorkoutTemplate(
            user_id=user_id,
            name=data.name,
            type=data.type,
            exercises=[ex.model_dump(mode="json") for ex in data.exercises],
            is_public=data.is_public,
        )
        template = await self.repository.create_template(template)
        await self.repository.replace_template_exercises(
            user_id=user_id,
            template_id=template.id,
            template_exercises=self._build_template_exercise_rows(
                user_id=user_id,
                exercises_payload=template.exercises,
            ),
        )
        audit_log(
            action=WORKOUT_TEMPLATE_CREATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template.id,
            client_ip=client_ip,
            meta={"type": data.type},
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def get_template(self, user_id: int, template_id: int) -> WorkoutTemplateResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def update_template(
        self,
        user_id: int,
        template_id: int,
        data: WorkoutTemplateCreate,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")

        template.name = data.name
        template.type = data.type
        template.exercises = [ex.model_dump(mode="json") for ex in data.exercises]
        template.is_public = data.is_public
        template.version += 1
        template = await self.repository.update_template(template)
        await self.repository.replace_template_exercises(
            user_id=user_id,
            template_id=template.id,
            template_exercises=self._build_template_exercise_rows(
                user_id=user_id,
                exercises_payload=template.exercises,
            ),
        )
        audit_log(
            action=WORKOUT_TEMPLATE_UPDATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def patch_template(
        self,
        user_id: int,
        template_id: int,
        data: WorkoutTemplatePatchRequest,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")

        next_name = data.name if data.name is not None else template.name
        next_type = data.type if data.type is not None else template.type
        next_public = data.is_public if data.is_public is not None else template.is_public
        next_exercises = template.exercises
        if data.exercises is not None:
            next_exercises = [ex.model_dump(mode="json") for ex in data.exercises]
        if data.exercise_order is not None:
            next_exercises = self._apply_reorder(next_exercises or [], data.exercise_order)

        updated = await self.repository.update_template_with_expected_version(
            user_id=user_id,
            template_id=template_id,
            expected_version=data.expected_version,
            values={
                "name": next_name,
                "type": next_type,
                "is_public": next_public,
                "exercises": next_exercises,
            },
        )
        if not updated:
            raise WorkoutConflictError("Template version mismatch. Refresh template and retry.")

        await self.repository.replace_template_exercises(
            user_id=user_id,
            template_id=updated.id,
            template_exercises=self._build_template_exercise_rows(
                user_id=user_id,
                exercises_payload=list(updated.exercises or []),
            ),
        )

        audit_log(
            action=WORKOUT_TEMPLATE_UPDATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
            meta={"mode": "patch", "expected_version": data.expected_version},
        )
        return WorkoutTemplateResponse.model_validate(updated, from_attributes=True)

    async def create_template_from_workout(
        self,
        user_id: int,
        data: WorkoutTemplateFromWorkoutCreate,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        workout = await self.repository.get_completed_workout(user_id=user_id, workout_id=data.workout_id)
        if not workout:
            raise WorkoutNotFoundError("Completed workout not found")

        exercises_raw = workout.exercises or []
        template_exercises: list[ExerciseInTemplate] = []
        for idx, raw in enumerate(exercises_raw):
            ex = CompletedExercise.model_validate(raw)
            first_set = ex.sets_completed[0]
            weight = next((s.weight for s in ex.sets_completed if s.weight is not None), None)
            template_exercises.append(
                ExerciseInTemplate(
                    exercise_id=ex.exercise_id or (idx + 1),
                    name=ex.name,
                    sets=max(len(ex.sets_completed), 1),
                    reps=first_set.reps,
                    duration=first_set.duration,
                    rest_seconds=60,
                    weight=weight,
                    notes=ex.notes,
                )
            )

        if not template_exercises:
            raise WorkoutConflictError("Workout has no exercises to create template")

        detected_type = "mixed"
        tags_set = {str(tag).lower() for tag in (workout.tags or [])}
        for candidate in ("strength", "cardio", "flexibility"):
            if candidate in tags_set:
                detected_type = candidate
                break

        template_name = (data.name or workout.comments or f"Шаблон из тренировки #{workout.id}").strip()
        template = WorkoutTemplate(
            user_id=user_id,
            name=template_name,
            type=detected_type,
            exercises=[ex.model_dump(mode="json") for ex in template_exercises],
            is_public=data.is_public,
        )
        template = await self.repository.create_template(template)
        await self.repository.replace_template_exercises(
            user_id=user_id,
            template_id=template.id,
            template_exercises=self._build_template_exercise_rows(
                user_id=user_id,
                exercises_payload=template.exercises,
            ),
        )
        audit_log(
            action=WORKOUT_TEMPLATE_CREATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template.id,
            client_ip=client_ip,
            meta={"source_workout_id": data.workout_id},
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def clone_template(
        self,
        user_id: int,
        template_id: int,
        data: WorkoutTemplateCloneRequest,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        source = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not source:
            raise WorkoutNotFoundError("Template not found")

        clone_name = (data.name or "").strip() or await self._build_clone_name(user_id=user_id, source_name=source.name)
        clone = WorkoutTemplate(
            user_id=user_id,
            name=clone_name,
            type=source.type,
            exercises=list(source.exercises or []),
            is_public=source.is_public if data.is_public is None else data.is_public,
        )
        clone = await self.repository.create_template(clone)
        await self.repository.replace_template_exercises(
            user_id=user_id,
            template_id=clone.id,
            template_exercises=self._build_template_exercise_rows(
                user_id=user_id,
                exercises_payload=clone.exercises,
            ),
        )
        audit_log(
            action=WORKOUT_TEMPLATE_CREATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=clone.id,
            client_ip=client_ip,
            meta={"cloned_from_template_id": template_id},
        )
        return WorkoutTemplateResponse.model_validate(clone, from_attributes=True)

    async def delete_template(
        self,
        user_id: int,
        template_id: int,
        client_ip: str | None = None,
    ) -> None:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")
        await self.repository.delete_template(template)
        audit_log(
            action=WORKOUT_TEMPLATE_DELETE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
        )

    async def archive_template(
        self,
        user_id: int,
        template_id: int,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")

        template.is_archived = True
        template.version += 1
        template = await self.repository.update_template(template)
        audit_log(
            action=WORKOUT_TEMPLATE_ARCHIVE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def unarchive_template(
        self,
        user_id: int,
        template_id: int,
        client_ip: str | None = None,
    ) -> WorkoutTemplateResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template:
            raise WorkoutNotFoundError("Template not found")

        template.is_archived = False
        template.version += 1
        template = await self.repository.update_template(template)
        audit_log(
            action=WORKOUT_TEMPLATE_UNARCHIVE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

    async def get_history(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> WorkoutHistoryResponse:
        total = await self.repository.count_history(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
        workouts = await self.repository.list_history(
            user_id=user_id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
        return WorkoutHistoryResponse(
            items=[WorkoutHistoryItem.model_validate(w, from_attributes=True) for w in workouts],
            total=total,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )

    async def start_workout(
        self,
        user_id: int,
        data: WorkoutStartRequest,
        client_ip: str | None = None,
    ) -> WorkoutStartResponse:
        template = None
        if data.template_id:
            template = await self.repository.get_template(user_id=user_id, template_id=data.template_id)
            if not template or template.is_archived:
                raise WorkoutNotFoundError("Template not found")

        initial_exercises = []
        if template is not None:
            initial_exercises = [
                self._exercise_template_to_workout_draft(ex, idx)
                for idx, ex in enumerate(template.exercises or [])
            ]

        workout = WorkoutLog(
            user_id=user_id,
            template_id=data.template_id,
            date=date.today(),
            exercises=initial_exercises,
            session_metrics=compute_session_metrics(initial_exercises, None),
            comments=data.name or (template.name if template else None),
            tags=([data.type.value] if data.type != WorkoutSessionType.CUSTOM else []),
        )
        workout = await self.repository.create_workout_log(workout)
        await self.repository.replace_session_snapshot(
            user_id=user_id,
            workout_session_id=workout.id,
            session_exercises=self._build_session_snapshot_rows(
                user_id=user_id,
                workout_session_id=workout.id,
                exercises_payload=initial_exercises,
            ),
        )
        await invalidate_user_analytics_cache(user_id)

        audit_log(
            action=WORKOUT_START,
            user_db_id=user_id,
            resource_type="workout_log",
            resource_id=workout.id,
            client_ip=client_ip,
            meta={"template_id": data.template_id},
        )

        return WorkoutStartResponse(
            id=workout.id,
            user_id=workout.user_id,
            template_id=workout.template_id,
            date=workout.date,
            start_time=workout.created_at,
            status="in_progress",
            message="Workout started successfully",
        )

    async def start_workout_from_template_with_overrides(
        self,
        user_id: int,
        template_id: int,
        data: WorkoutStartFromTemplateRequest,
        client_ip: str | None = None,
    ) -> WorkoutStartResponse:
        template = await self.repository.get_template(user_id=user_id, template_id=template_id)
        if not template or template.is_archived:
            raise WorkoutNotFoundError("Template not found")

        initial_exercises, override_comments, override_tags = self._resolve_start_overrides(
            template_exercises=template.exercises or [],
            overrides=data.overrides,
        )

        workout = WorkoutLog(
            user_id=user_id,
            template_id=template_id,
            date=date.today(),
            exercises=initial_exercises,
            session_metrics=compute_session_metrics(initial_exercises, None),
            comments=data.name or override_comments or template.name,
            tags=override_tags or ([data.type.value] if data.type != WorkoutSessionType.CUSTOM else []),
        )
        workout = await self.repository.create_workout_log(workout)
        await self.repository.replace_session_snapshot(
            user_id=user_id,
            workout_session_id=workout.id,
            session_exercises=self._build_session_snapshot_rows(
                user_id=user_id,
                workout_session_id=workout.id,
                exercises_payload=initial_exercises,
            ),
        )
        await invalidate_user_analytics_cache(user_id)

        audit_log(
            action=WORKOUT_START,
            user_db_id=user_id,
            resource_type="workout_log",
            resource_id=workout.id,
            client_ip=client_ip,
            meta={
                "template_id": template_id,
                "template_version": template.version,
                "has_overrides": bool(data.overrides),
            },
        )

        return WorkoutStartResponse(
            id=workout.id,
            user_id=workout.user_id,
            template_id=workout.template_id,
            date=workout.date,
            start_time=workout.created_at,
            status="in_progress",
            message="Workout started from template with overrides",
        )

    async def _upsert_training_load_daily(self, user_id: int, target_date: date) -> None:
        day_workouts = await self.repository.list_workouts_for_day(user_id=user_id, target_date=target_date)

        total_duration = 0
        total_volume = 0.0
        day_rpe_values: list[float] = []
        for workout in day_workouts:
            if workout.duration:
                total_duration += int(workout.duration)
            workout_volume, workout_rpe_values = self._extract_workout_volume_and_rpe(workout.exercises)
            total_volume += workout_volume
            day_rpe_values.extend(workout_rpe_values)

        avg_rpe = round(sum(day_rpe_values) / len(day_rpe_values), 1) if day_rpe_values else None
        fatigue_score = round(total_duration * avg_rpe, 2) if avg_rpe is not None else 0.0

        training_load = await self.repository.get_training_load(user_id=user_id, target_date=target_date)
        if training_load:
            training_load.volume = Decimal(str(round(total_volume, 2)))
            training_load.avg_rpe = Decimal(str(avg_rpe)) if avg_rpe is not None else None
            training_load.fatigue_score = Decimal(str(fatigue_score))
            return

        self.repository.add_training_load_daily(
            TrainingLoadDaily(
                user_id=user_id,
                date=target_date,
                volume=Decimal(str(round(total_volume, 2))),
                avg_rpe=Decimal(str(avg_rpe)) if avg_rpe is not None else None,
                fatigue_score=Decimal(str(fatigue_score)),
            )
        )

    async def _upsert_muscle_load_daily(self, user_id: int, target_date: date) -> None:
        day_workouts = await self.repository.list_workouts_for_day(user_id=user_id, target_date=target_date)

        exercise_ids: set[int] = set()
        for workout in day_workouts:
            exercises = workout.exercises or []
            for exercise in exercises:
                if not isinstance(exercise, dict):
                    continue
                exercise_id_raw = exercise.get("exercise_id")
                try:
                    if exercise_id_raw is not None:
                        exercise_ids.add(int(exercise_id_raw))
                except (TypeError, ValueError):
                    continue

        exercise_groups_map: dict[int, list[str]] = {}
        exercises = await self.repository.list_exercises_by_ids(exercise_ids)
        for ex in exercises:
            exercise_groups_map[int(ex.id)] = list(ex.muscle_groups or [])

        day_muscle_load: dict[str, float] = {}
        for workout in day_workouts:
            workout_load = self._extract_workout_muscle_load(workout.exercises, exercise_groups_map)
            for muscle_group, value in workout_load.items():
                day_muscle_load[muscle_group] = day_muscle_load.get(muscle_group, 0.0) + value

        existing_rows = await self.repository.list_muscle_load_for_day(user_id=user_id, target_date=target_date)
        existing_by_group = {row.muscle_group: row for row in existing_rows}
        new_groups = set(day_muscle_load.keys())

        for group, load_score in day_muscle_load.items():
            row = existing_by_group.get(group)
            value = Decimal(str(round(load_score, 2)))
            if row:
                row.load_score = value
            else:
                self.repository.add_muscle_load(
                    MuscleLoad(
                        user_id=user_id,
                        muscle_group=group,
                        date=target_date,
                        load_score=value,
                    )
                )

        for group, row in existing_by_group.items():
            if group not in new_groups:
                await self.repository.delete_muscle_load(row)

    async def _upsert_recovery_state(self, user_id: int, target_date: date) -> None:
        training = await self.repository.get_training_load(user_id=user_id, target_date=target_date)
        fatigue_score = float(training.fatigue_score) if training and training.fatigue_score is not None else 0.0
        fatigue_level = int(round(self._clamp(fatigue_score / 5.0)))

        latest_wellness = await self.repository.get_latest_wellness_on_or_before(
            user_id=user_id,
            target_date=target_date,
        )
        readiness_raw = 100.0 - (fatigue_level * 0.6)
        if latest_wellness:
            sleep_score = float(latest_wellness.sleep_score or 0)
            energy_score = float(latest_wellness.energy_score or 0)
            stress_level = float(latest_wellness.stress_level or 0)
            readiness_raw += ((sleep_score - 50) * 0.2)
            readiness_raw += ((energy_score - 50) * 0.3)
            readiness_raw -= (stress_level * 2.0)

        readiness_score = round(self._clamp(readiness_raw), 2)
        state = await self.repository.get_recovery_state(user_id=user_id)
        if state:
            state.fatigue_level = fatigue_level
            state.readiness_score = Decimal(str(readiness_score))
            return

        self.repository.add_recovery_state(
            RecoveryState(
                user_id=user_id,
                fatigue_level=fatigue_level,
                readiness_score=Decimal(str(readiness_score)),
            )
        )

    def _workout_log_to_complete_response(
        self,
        workout: WorkoutLog,
        exercises: list[CompletedExercise],
        *,
        message: str,
    ) -> WorkoutCompleteResponse:
        return WorkoutCompleteResponse(
            id=workout.id,
            user_id=workout.user_id,
            template_id=workout.template_id,
            date=workout.date,
            duration=workout.duration or 0,
            exercises=exercises,
            comments=workout.comments,
            tags=list(workout.tags or []),
            glucose_before=float(workout.glucose_before) if workout.glucose_before is not None else None,
            glucose_after=float(workout.glucose_after) if workout.glucose_after is not None else None,
            session_metrics=self._session_metrics_model(
                workout.session_metrics or compute_session_metrics(workout.exercises or [], workout.duration)
            ),
            version=workout.version,
            completed_at=workout.updated_at,
            message=message,
        )

    def _workout_log_to_history_item(
        self,
        workout: WorkoutLog,
        exercises: list[CompletedExercise],
    ) -> WorkoutHistoryItem:
        return WorkoutHistoryItem(
            id=workout.id,
            date=workout.date,
            duration=workout.duration,
            exercises=exercises,
            comments=workout.comments,
            tags=list(workout.tags or []),
            glucose_before=float(workout.glucose_before) if workout.glucose_before is not None else None,
            glucose_after=float(workout.glucose_after) if workout.glucose_after is not None else None,
            session_metrics=self._session_metrics_model(
                workout.session_metrics or compute_session_metrics(workout.exercises or [], workout.duration)
            ),
            version=workout.version,
            created_at=workout.created_at,
        )

    @staticmethod
    def _request_payload_hash(payload: dict) -> str:
        normalized = str(sorted(payload.items())).encode("utf-8")
        return hashlib.sha256(normalized).hexdigest()

    async def update_workout_session(
        self,
        user_id: int,
        workout_id: int,
        data: WorkoutSessionUpdateRequest,
        client_ip: str | None = None,
    ) -> WorkoutHistoryItem:
        operation_type = "session_update"
        payload_dump = data.model_dump(mode="json")
        request_hash = self._request_payload_hash(payload_dump)

        if data.idempotency_key:
            cached = await self.repository.get_idempotency_record(
                user_id=user_id,
                operation_type=operation_type,
                idempotency_key=data.idempotency_key,
            )
            if cached:
                if cached.request_hash != request_hash:
                    raise WorkoutConflictError(
                        "Idempotency key reused with different payload",
                        details={
                            "idempotency_key": data.idempotency_key,
                            "operation_type": operation_type,
                        },
                    )
                return WorkoutHistoryItem.model_validate(cached.response_payload)

        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout:
            raise WorkoutNotFoundError("Workout not found")
        if workout.duration is not None:
            raise WorkoutNotFoundError("Completed workout cannot be updated")
        if data.expected_version is not None and workout.version != data.expected_version:
            raise WorkoutConflictError(
                "Workout version mismatch",
                details={
                    "expected_version": data.expected_version,
                    "current_version": workout.version,
                    "workout_id": workout_id,
                },
            )

        workout.exercises = [ex.model_dump(mode="json") for ex in data.exercises]
        workout.comments = data.comments
        workout.tags = data.tags
        workout.glucose_before = data.glucose_before
        workout.glucose_after = data.glucose_after
        workout.session_metrics = compute_session_metrics(workout.exercises, workout.duration)
        workout.version += 1

        workout = await self.repository.commit_workout_update(workout)
        await self.repository.replace_session_snapshot(
            user_id=user_id,
            workout_session_id=workout.id,
            session_exercises=self._build_session_snapshot_rows(
                user_id=user_id,
                workout_session_id=workout.id,
                exercises_payload=workout.exercises or [],
            ),
        )
        response_item = self._workout_log_to_history_item(workout, data.exercises)

        if data.idempotency_key:
            await self.repository.create_idempotency_record(
                user_id=user_id,
                operation_type=operation_type,
                idempotency_key=data.idempotency_key,
                resource_id=workout_id,
                request_hash=request_hash,
                response_payload=response_item.model_dump(mode="json"),
            )

        audit_log(
            action=WORKOUT_UPDATE,
            user_db_id=user_id,
            resource_type="workout_log",
            resource_id=workout_id,
            client_ip=client_ip,
            meta={"exercise_count": len(data.exercises)},
        )

        return response_item

    async def _complete_workout_once(
        self,
        user_id: int,
        workout_id: int,
        data: WorkoutCompleteRequest,
        client_ip: str | None = None,
    ) -> WorkoutCompleteResponse:
        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout:
            raise WorkoutNotFoundError("Workout not found")
        if data.expected_version is not None and workout.version != data.expected_version:
            raise WorkoutConflictError(
                "Workout version mismatch",
                details={
                    "expected_version": data.expected_version,
                    "current_version": workout.version,
                    "workout_id": workout_id,
                },
            )

        if workout.duration is not None:
            raw_ex = workout.exercises or []
            exercises = [CompletedExercise.model_validate(ex) for ex in raw_ex]
            return self._workout_log_to_complete_response(
                workout,
                exercises,
                message="Workout was already completed; duplicate request ignored.",
            )

        workout.duration = data.duration
        workout.exercises = [ex.model_dump(mode="json") for ex in data.exercises]
        workout.comments = data.comments
        workout.tags = data.tags
        workout.glucose_before = data.glucose_before
        workout.glucose_after = data.glucose_after
        workout.session_metrics = compute_session_metrics(workout.exercises, workout.duration)
        workout.version += 1

        await self._upsert_training_load_daily(user_id=user_id, target_date=workout.date)
        await self._upsert_muscle_load_daily(user_id=user_id, target_date=workout.date)
        await self._upsert_recovery_state(user_id=user_id, target_date=workout.date)

        await self.repository.commit_workout_completion(workout)
        await self.repository.replace_session_snapshot(
            user_id=user_id,
            workout_session_id=workout.id,
            session_exercises=self._build_session_snapshot_rows(
                user_id=user_id,
                workout_session_id=workout.id,
                exercises_payload=workout.exercises or [],
            ),
        )
        await invalidate_user_analytics_cache(user_id)

        audit_log(
            action=WORKOUT_COMPLETE,
            user_db_id=user_id,
            resource_type="workout_log",
            resource_id=workout_id,
            client_ip=client_ip,
            meta={"duration_min": data.duration},
        )

        return WorkoutCompleteResponse(
            id=workout.id,
            user_id=workout.user_id,
            template_id=workout.template_id,
            date=workout.date,
            duration=workout.duration,
            exercises=data.exercises,
            comments=workout.comments,
            tags=workout.tags,
            glucose_before=workout.glucose_before,
            glucose_after=workout.glucose_after,
            session_metrics=self._session_metrics_model(workout.session_metrics),
            version=workout.version,
            completed_at=workout.updated_at,
            message="Workout completed successfully",
        )

    async def complete_workout(
        self,
        user_id: int,
        workout_id: int,
        data: WorkoutCompleteRequest,
        client_ip: str | None = None,
        idempotency_key: str | None = None,
    ) -> WorkoutCompleteResponse:
        operation_type = "session_complete"
        payload_dump = data.model_dump(mode="json")
        request_hash = self._request_payload_hash(payload_dump)

        if data.idempotency_key:
            cached = await self.repository.get_idempotency_record(
                user_id=user_id,
                operation_type=operation_type,
                idempotency_key=data.idempotency_key,
            )
            if cached:
                if cached.request_hash != request_hash:
                    raise WorkoutConflictError(
                        "Idempotency key reused with different payload",
                        details={
                            "idempotency_key": data.idempotency_key,
                            "operation_type": operation_type,
                        },
                    )
                return WorkoutCompleteResponse.model_validate(cached.response_payload)

        async def _run() -> WorkoutCompleteResponse:
            return await self._complete_workout_once(
                user_id=user_id,
                workout_id=workout_id,
                data=data,
                client_ip=client_ip,
            )

        if data.idempotency_key:
            response = await _run()
            await self.repository.create_idempotency_record(
                user_id=user_id,
                operation_type=operation_type,
                idempotency_key=data.idempotency_key,
                resource_id=workout_id,
                request_hash=request_hash,
                response_payload=response.model_dump(mode="json"),
            )
            return response

        if idempotency_key:
            return await run_idempotent(
                user_id=user_id,
                scope=f"workout_complete:{workout_id}",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_DEFAULT_TTL_SECONDS,
                execute=_run,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: WorkoutCompleteResponse.model_validate(d),
            )
        return await _run()

    async def get_workout_detail(self, user_id: int, workout_id: int) -> WorkoutHistoryItem:
        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout:
            raise WorkoutNotFoundError("Workout not found")
        raw_exercises = workout.exercises or []
        exercises = [CompletedExercise.model_validate(ex) for ex in raw_exercises]
        return self._workout_log_to_history_item(workout, exercises)

    async def patch_workout_set(
        self,
        *,
        user_id: int,
        workout_id: int,
        set_id: int,
        data: WorkoutSetPatchRequest,
        client_ip: str | None = None,
    ) -> WorkoutSetResponse:
        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout or workout.duration is not None:
            raise WorkoutNotFoundError("Workout not found")

        db_set = await self.repository.get_workout_set(
            user_id=user_id,
            workout_session_id=workout_id,
            set_id=set_id,
        )
        if not db_set or not db_set.session_exercise:
            raise WorkoutNotFoundError("Set not found")

        exercise_id = int(db_set.session_exercise.exercise_id)
        target_set_number = int(db_set.set_number)

        exercises = list(workout.exercises or [])
        updated_set: dict | None = None
        for ex in exercises:
            if not isinstance(ex, dict):
                continue
            if int(ex.get("exercise_id") or 0) != exercise_id:
                continue
            sets = ex.get("sets_completed")
            if not isinstance(sets, list):
                continue
            for set_item in sets:
                if not isinstance(set_item, dict):
                    continue
                if int(set_item.get("set_number") or 0) != target_set_number:
                    continue
                if data.rest_seconds is not None:
                    set_item["rest_seconds"] = data.rest_seconds
                    # keep legacy field in sync for existing analytics/clients
                    set_item["actual_rest_seconds"] = data.rest_seconds
                if data.rpe is not None:
                    set_item["rpe"] = data.rpe
                updated_set = set_item
                break
            break

        if updated_set is None:
            raise WorkoutNotFoundError("Set not found")

        workout.exercises = exercises
        workout.session_metrics = compute_session_metrics(workout.exercises, workout.duration)
        workout.version += 1

        workout = await self.repository.commit_workout_update(workout)
        await self.repository.replace_session_snapshot(
            user_id=user_id,
            workout_session_id=workout.id,
            session_exercises=self._build_session_snapshot_rows(
                user_id=user_id,
                workout_session_id=workout.id,
                exercises_payload=workout.exercises or [],
            ),
        )

        audit_log(
            action=WORKOUT_UPDATE,
            user_db_id=user_id,
            resource_type="workout_log",
            resource_id=workout_id,
            client_ip=client_ip,
            meta={"mode": "patch_set", "set_id": set_id},
        )

        return WorkoutSetResponse(
            id=set_id,
            workout_id=workout_id,
            exercise_id=exercise_id,
            set_number=target_set_number,
            rest_seconds=updated_set.get("rest_seconds"),
            rpe=updated_set.get("rpe"),
        )
