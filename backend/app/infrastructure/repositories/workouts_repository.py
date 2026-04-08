from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import and_, delete, desc, func, select, update

from app.domain.daily_wellness import DailyWellness
from app.domain.exercise import Exercise
from app.domain.idempotency_record import IdempotencyRecord
from app.domain.muscle_load import MuscleLoad
from app.domain.recovery_state import RecoveryState
from app.domain.training_load_daily import TrainingLoadDaily
from app.domain.template_exercise import TemplateExercise
from app.domain.workout_log import WorkoutLog
from app.domain.workout_session_exercise import WorkoutSessionExercise
from app.domain.workout_set import WorkoutSet
from app.domain.workout_template import WorkoutTemplate
from app.infrastructure.repositories.base import SQLAlchemyRepository


class WorkoutsRepository(SQLAlchemyRepository):
    async def get_last_set_for_exercise(
        self,
        user_id: int,
        workout_session_id: int,
        exercise_id: int,
    ) -> Optional[WorkoutSet]:
        """
        Получает последний сет для упражнения в сессии.
        exercise_id - это ID упражнения из справочника (reference data).
        """
        # Сначала находим workout_session_exercise по exercise_id (справочник)
        session_exercise_result = await self.db.execute(
            select(WorkoutSessionExercise.id)
            .where(
                and_(
                    WorkoutSessionExercise.user_id == user_id,
                    WorkoutSessionExercise.workout_session_id == workout_session_id,
                    WorkoutSessionExercise.exercise_id == exercise_id,
                )
            )
            .order_by(WorkoutSessionExercise.created_at.desc())
            .limit(1)
        )
        session_exercise_id = session_exercise_result.scalar_one_or_none()
        
        if not session_exercise_id:
            return None
        
        # Теперь ищем последний сет для этого session_exercise
        result = await self.db.execute(
            select(WorkoutSet)
            .where(
                and_(
                    WorkoutSet.user_id == user_id,
                    WorkoutSet.workout_session_id == workout_session_id,
                    WorkoutSet.workout_session_exercise_id == session_exercise_id,
                )
            )
            .order_by(WorkoutSet.set_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def count_templates(
        self,
        user_id: int,
        template_type: Optional[str],
        include_archived: bool = False,
    ) -> int:
        query = select(func.count(WorkoutTemplate.id)).where(WorkoutTemplate.user_id == user_id)
        if not include_archived:
            query = query.where(WorkoutTemplate.is_archived.is_(False))
        if template_type:
            query = query.where(WorkoutTemplate.type == template_type)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_templates(
        self,
        user_id: int,
        page: int,
        page_size: int,
        template_type: Optional[str],
        include_archived: bool = False,
    ) -> List[WorkoutTemplate]:
        query = select(WorkoutTemplate).where(WorkoutTemplate.user_id == user_id)
        if not include_archived:
            query = query.where(WorkoutTemplate.is_archived.is_(False))
        if template_type:
            query = query.where(WorkoutTemplate.type == template_type)
        query = (
            query.order_by(desc(WorkoutTemplate.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_template_names(self, user_id: int) -> List[str]:
        result = await self.db.execute(
            select(WorkoutTemplate.name).where(WorkoutTemplate.user_id == user_id)
        )
        return [name for name in result.scalars().all() if isinstance(name, str) and name.strip()]

    async def get_template(self, user_id: int, template_id: int) -> Optional[WorkoutTemplate]:
        result = await self.db.execute(
            select(WorkoutTemplate).where(
                and_(
                    WorkoutTemplate.id == template_id,
                    WorkoutTemplate.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def update_template_with_expected_version(
        self,
        *,
        user_id: int,
        template_id: int,
        expected_version: int,
        values: dict,
    ) -> Optional[WorkoutTemplate]:
        stmt = (
            update(WorkoutTemplate)
            .where(
                and_(
                    WorkoutTemplate.id == template_id,
                    WorkoutTemplate.user_id == user_id,
                    WorkoutTemplate.version == expected_version,
                )
            )
            .values(
                **values,
                version=WorkoutTemplate.version + 1,
                updated_at=func.now(),
            )
        )
        result = await self.db.execute(stmt)
        if (result.rowcount or 0) == 0:
            await self.db.rollback()
            return None
        await self.commit()
        return await self.get_template(user_id=user_id, template_id=template_id)

    async def count_history(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> int:
        query = select(func.count(WorkoutLog.id)).where(WorkoutLog.user_id == user_id)
        if date_from:
            query = query.where(WorkoutLog.date >= date_from)
        if date_to:
            query = query.where(WorkoutLog.date <= date_to)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_history(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[WorkoutLog]:
        query = select(WorkoutLog).where(WorkoutLog.user_id == user_id)
        if date_from:
            query = query.where(WorkoutLog.date >= date_from)
        if date_to:
            query = query.where(WorkoutLog.date <= date_to)
        query = query.order_by(desc(WorkoutLog.date)).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_workout(self, user_id: int, workout_id: int) -> Optional[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.id == workout_id,
                    WorkoutLog.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_completed_workout(self, user_id: int, workout_id: int) -> Optional[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.id == workout_id,
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.duration.is_not(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_workouts_for_day(self, user_id: int, target_date: date) -> List[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date == target_date,
                )
            )
        )
        return result.scalars().all()

    async def list_workouts_in_range(self, user_id: int, date_from: date, date_to: date) -> List[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog)
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                    WorkoutLog.date <= date_to,
                )
            )
            .order_by(WorkoutLog.date.asc(), WorkoutLog.id.asc())
        )
        return result.scalars().all()

    async def list_exercises_by_ids(self, exercise_ids: set[int]) -> List[Exercise]:
        if not exercise_ids:
            return []
        result = await self.db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
        return result.scalars().all()

    async def get_training_load(self, user_id: int, target_date: date) -> Optional[TrainingLoadDaily]:
        result = await self.db.execute(
            select(TrainingLoadDaily).where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date == target_date,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_muscle_load_for_day(self, user_id: int, target_date: date) -> List[MuscleLoad]:
        result = await self.db.execute(
            select(MuscleLoad).where(
                and_(
                    MuscleLoad.user_id == user_id,
                    MuscleLoad.date == target_date,
                )
            )
        )
        return result.scalars().all()

    async def get_latest_wellness_on_or_before(
        self,
        user_id: int,
        target_date: date,
    ) -> Optional[DailyWellness]:
        result = await self.db.execute(
            select(DailyWellness)
            .where(
                and_(
                    DailyWellness.user_id == user_id,
                    DailyWellness.date <= target_date,
                )
            )
            .order_by(DailyWellness.date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_recovery_state(self, user_id: int) -> Optional[RecoveryState]:
        result = await self.db.execute(
            select(RecoveryState).where(RecoveryState.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_template(self, template: WorkoutTemplate) -> WorkoutTemplate:
        self.add(template)
        await self.commit()
        await self.refresh(template)
        return template

    async def update_template(self, template: WorkoutTemplate) -> WorkoutTemplate:
        await self.commit()
        await self.refresh(template)
        return template

    async def replace_template_exercises(
        self,
        *,
        user_id: int,
        template_id: int,
        template_exercises: list[TemplateExercise],
    ) -> None:
        await self.db.execute(
            delete(TemplateExercise).where(
                and_(
                    TemplateExercise.user_id == user_id,
                    TemplateExercise.template_id == template_id,
                )
            )
        )
        for row in template_exercises:
            row.template_id = template_id
            self.add(row)
        await self.commit()

    async def delete_template(self, template: WorkoutTemplate) -> None:
        # Detach historical workouts from template before physical delete.
        # This keeps history intact and avoids FK conflicts for already used templates.
        await self.db.execute(
            update(WorkoutLog)
            .where(
                and_(
                    WorkoutLog.user_id == template.user_id,
                    WorkoutLog.template_id == template.id,
                )
            )
            .values(template_id=None)
        )
        await self.delete(template)
        await self.commit()

    async def create_workout_log(self, workout: WorkoutLog) -> WorkoutLog:
        self.add(workout)
        await self.commit()
        await self.refresh(workout)
        return workout

    async def commit_workout_update(self, workout: WorkoutLog) -> WorkoutLog:
        await self.commit()
        await self.refresh(workout)
        return workout

    async def replace_session_snapshot(
        self,
        *,
        user_id: int,
        workout_session_id: int,
        session_exercises: list[WorkoutSessionExercise],
    ) -> None:
        await self.db.execute(
            delete(WorkoutSet).where(
                and_(
                    WorkoutSet.user_id == user_id,
                    WorkoutSet.workout_session_id == workout_session_id,
                )
            )
        )
        await self.db.execute(
            delete(WorkoutSessionExercise).where(
                and_(
                    WorkoutSessionExercise.user_id == user_id,
                    WorkoutSessionExercise.workout_session_id == workout_session_id,
                )
            )
        )
        for row in session_exercises:
            self.add(row)
        await self.commit()

    def add_training_load_daily(self, row: TrainingLoadDaily) -> None:
        self.add(row)

    def add_muscle_load(self, row: MuscleLoad) -> None:
        self.add(row)

    async def delete_muscle_load(self, row: MuscleLoad) -> None:
        await self.delete(row)

    def add_recovery_state(self, row: RecoveryState) -> None:
        self.add(row)

    async def commit_workout_completion(self, workout: WorkoutLog) -> None:
        await self.commit()
        await self.refresh(workout)

    async def get_idempotency_record(
        self,
        *,
        user_id: int,
        operation_type: str,
        idempotency_key: str,
    ) -> Optional[IdempotencyRecord]:
        result = await self.db.execute(
            select(IdempotencyRecord).where(
                and_(
                    IdempotencyRecord.user_id == user_id,
                    IdempotencyRecord.operation_type == operation_type,
                    IdempotencyRecord.idempotency_key == idempotency_key,
                )
            )
        )
        return result.scalar_one_or_none()

    async def create_idempotency_record(
        self,
        *,
        user_id: int,
        operation_type: str,
        idempotency_key: str,
        resource_id: int,
        request_hash: str,
        response_payload: dict,
    ) -> IdempotencyRecord:
        record = IdempotencyRecord(
            user_id=user_id,
            operation_type=operation_type,
            idempotency_key=idempotency_key,
            resource_id=resource_id,
            request_hash=request_hash,
            response_payload=response_payload,
        )
        self.add(record)
        await self.commit()
        await self.refresh(record)
        return record
