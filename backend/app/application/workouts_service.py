from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.muscle_load import MuscleLoad
from app.domain.recovery_state import RecoveryState
from app.domain.training_load_daily import TrainingLoadDaily
from app.domain.workout_log import WorkoutLog
from app.domain.workout_template import WorkoutTemplate
from app.domain.exceptions import WorkoutNotFoundError
from app.infrastructure.repositories.workouts_repository import WorkoutsRepository
from app.schemas.workouts import (
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateList,
    WorkoutTemplateResponse,
)
from app.infrastructure.cache import invalidate_user_analytics_cache
from app.core.audit import (
    WORKOUT_COMPLETE,
    WORKOUT_START,
    WORKOUT_TEMPLATE_CREATE,
    WORKOUT_TEMPLATE_DELETE,
    WORKOUT_TEMPLATE_UPDATE,
    audit_log,
)


class WorkoutsService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = WorkoutsRepository(db)

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

    async def get_templates(
        self,
        user_id: int,
        page: int,
        page_size: int,
        template_type: Optional[str],
    ) -> WorkoutTemplateList:
        total = await self.repository.count_templates(user_id=user_id, template_type=template_type)
        templates = await self.repository.list_templates(
            user_id=user_id,
            page=page,
            page_size=page_size,
            template_type=template_type,
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
            exercises=[ex.model_dump() for ex in data.exercises],
            is_public=data.is_public,
        )
        template = await self.repository.create_template(template)
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
        template.exercises = [ex.model_dump() for ex in data.exercises]
        template.is_public = data.is_public
        template = await self.repository.update_template(template)
        audit_log(
            action=WORKOUT_TEMPLATE_UPDATE,
            user_db_id=user_id,
            resource_type="workout_template",
            resource_id=template_id,
            client_ip=client_ip,
        )
        return WorkoutTemplateResponse.model_validate(template, from_attributes=True)

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
        if data.template_id:
            template = await self.repository.get_template(user_id=user_id, template_id=data.template_id)
            if not template:
                raise WorkoutNotFoundError("Template not found")

        workout = WorkoutLog(
            user_id=user_id,
            template_id=data.template_id,
            date=date.today(),
            exercises=[],
            comments=data.name,
        )
        workout = await self.repository.create_workout_log(workout)
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

    async def complete_workout(
        self,
        user_id: int,
        workout_id: int,
        data: WorkoutCompleteRequest,
        client_ip: str | None = None,
    ) -> WorkoutCompleteResponse:
        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout:
            raise WorkoutNotFoundError("Workout not found")

        workout.duration = data.duration
        workout.exercises = [ex.model_dump() for ex in data.exercises]
        workout.comments = data.comments
        workout.tags = data.tags
        workout.glucose_before = data.glucose_before
        workout.glucose_after = data.glucose_after

        await self._upsert_training_load_daily(user_id=user_id, target_date=workout.date)
        await self._upsert_muscle_load_daily(user_id=user_id, target_date=workout.date)
        await self._upsert_recovery_state(user_id=user_id, target_date=workout.date)

        await self.repository.commit_workout_completion(workout)
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
            completed_at=workout.updated_at,
            message="Workout completed successfully",
        )

    async def get_workout_detail(self, user_id: int, workout_id: int) -> WorkoutHistoryItem:
        workout = await self.repository.get_workout(user_id=user_id, workout_id=workout_id)
        if not workout:
            raise WorkoutNotFoundError("Workout not found")
        return WorkoutHistoryItem.model_validate(workout, from_attributes=True)
