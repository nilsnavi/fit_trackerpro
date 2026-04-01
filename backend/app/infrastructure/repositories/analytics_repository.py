from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import Integer, and_, cast, desc, func, literal, or_, select, text, true

from app.domain.daily_wellness import DailyWellness
from app.domain.muscle_load import MuscleLoad
from app.domain.recovery_state import RecoveryState
from app.domain.training_load_daily import TrainingLoadDaily
from app.domain.workout_log import WorkoutLog
from app.infrastructure.repositories.base import SQLAlchemyRepository


class AnalyticsRepository(SQLAlchemyRepository):

    async def list_training_load_daily(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[TrainingLoadDaily]:
        result = await self.db.execute(
            select(TrainingLoadDaily)
            .where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date >= date_from,
                    TrainingLoadDaily.date <= date_to,
                )
            )
            .order_by(TrainingLoadDaily.date.asc())
        )
        return result.scalars().all()

    async def count_training_load_daily(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> int:
        result = await self.db.execute(
            select(func.count(TrainingLoadDaily.id)).where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date >= date_from,
                    TrainingLoadDaily.date <= date_to,
                )
            )
        )
        return int(result.scalar() or 0)

    async def list_training_load_daily_paginated(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        page: int,
        page_size: int,
    ) -> List[TrainingLoadDaily]:
        result = await self.db.execute(
            select(TrainingLoadDaily)
            .where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date >= date_from,
                    TrainingLoadDaily.date <= date_to,
                )
            )
            .order_by(desc(TrainingLoadDaily.date))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all()

    async def list_muscle_load(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[MuscleLoad]:
        result = await self.db.execute(
            select(MuscleLoad)
            .where(
                and_(
                    MuscleLoad.user_id == user_id,
                    MuscleLoad.date >= date_from,
                    MuscleLoad.date <= date_to,
                )
            )
            .order_by(MuscleLoad.date.asc(), MuscleLoad.muscle_group.asc())
        )
        return result.scalars().all()

    async def count_muscle_load(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        muscle_group: Optional[str] = None,
    ) -> int:
        base_filters = and_(
            MuscleLoad.user_id == user_id,
            MuscleLoad.date >= date_from,
            MuscleLoad.date <= date_to,
        )
        if muscle_group:
            base_filters = and_(
                base_filters,
                MuscleLoad.muscle_group == muscle_group,
            )

        result = await self.db.execute(
            select(func.count(MuscleLoad.id)).where(base_filters)
        )
        return int(result.scalar() or 0)

    async def list_muscle_load_paginated(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        page: int,
        page_size: int,
        muscle_group: Optional[str] = None,
    ) -> List[MuscleLoad]:
        base_filters = and_(
            MuscleLoad.user_id == user_id,
            MuscleLoad.date >= date_from,
            MuscleLoad.date <= date_to,
        )
        if muscle_group:
            base_filters = and_(
                base_filters,
                MuscleLoad.muscle_group == muscle_group,
            )

        result = await self.db.execute(
            select(MuscleLoad)
            .where(base_filters)
            .order_by(desc(MuscleLoad.date), MuscleLoad.muscle_group.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return result.scalars().all()

    async def get_recovery_state(self, user_id: int) -> Optional[RecoveryState]:
        result = await self.db.execute(
            select(RecoveryState).where(RecoveryState.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_training_load_for_day(
        self,
        user_id: int,
        target_date: date,
    ) -> Optional[TrainingLoadDaily]:
        result = await self.db.execute(
            select(TrainingLoadDaily).where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date == target_date,
                )
            )
        )
        return result.scalar_one_or_none()

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

    async def upsert_recovery_state(
        self,
        user_id: int,
        fatigue_level: int,
        readiness_score: float,
    ) -> RecoveryState:
        state = await self.get_recovery_state(user_id)
        score = Decimal(str(readiness_score))
        if state:
            state.fatigue_level = fatigue_level
            state.readiness_score = score
            return state

        state = RecoveryState(
            user_id=user_id,
            fatigue_level=fatigue_level,
            readiness_score=score,
        )
        self.add(state)
        return state

    async def commit_recovery_state_recalculation(self, state: RecoveryState) -> RecoveryState:
        await self.commit()
        await self.refresh(state)
        return state

    async def get_exercise_progress_summary(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        exercise_id: Optional[int],
        max_exercises: int,
    ) -> List[Dict[str, Any]]:
        parsed_sets_cte = """
            WITH parsed_sets AS (
                SELECT
                    wl.date AS workout_date,
                    (exercise_item.item->>'exercise_id')::int AS exercise_id,
                    COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                    NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                    NULLIF(set_item.item->>'reps', '')::int AS reps
                FROM workout_logs wl
                CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                CROSS JOIN LATERAL jsonb_array_elements(
                    COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                ) AS set_item(item)
                WHERE wl.user_id = :user_id
                  AND wl.date >= :date_from
                  AND wl.date <= :date_to
                  AND exercise_item.item ? 'exercise_id'
                  AND (:exercise_id IS NULL OR (exercise_item.item->>'exercise_id')::int = :exercise_id)
            ),
            limited_exercises AS (
                SELECT exercise_id
                FROM parsed_sets
                GROUP BY exercise_id
                ORDER BY MAX(workout_date) DESC, exercise_id
                LIMIT :max_exercises
            ),
            filtered_sets AS (
                SELECT ps.*
                FROM parsed_sets ps
                JOIN limited_exercises le ON le.exercise_id = ps.exercise_id
            )
        """
        params = {
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
            "exercise_id": exercise_id,
            "max_exercises": max_exercises,
        }
        result = await self.db.execute(
            text(
                parsed_sets_cte
                + """
                SELECT
                    exercise_id,
                    MAX(exercise_name) AS exercise_name,
                    COUNT(*) AS total_sets,
                    COALESCE(SUM(reps), 0) AS total_reps,
                    MAX(weight) AS max_weight,
                    AVG(weight) AS avg_weight,
                    MIN(workout_date) AS first_date,
                    MAX(workout_date) AS last_date
                FROM filtered_sets
                GROUP BY exercise_id
                ORDER BY MAX(workout_date) DESC, exercise_id
                """
            ),
            params,
        )
        return result.mappings().all()

    async def get_exercise_progress_data_points(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        exercise_id: Optional[int],
        max_exercises: int,
        max_data_points: int,
    ) -> List[Dict[str, Any]]:
        parsed_sets_cte = """
            WITH parsed_sets AS (
                SELECT
                    wl.date AS workout_date,
                    (exercise_item.item->>'exercise_id')::int AS exercise_id,
                    COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                    NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                    NULLIF(set_item.item->>'reps', '')::int AS reps
                FROM workout_logs wl
                CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                CROSS JOIN LATERAL jsonb_array_elements(
                    COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                ) AS set_item(item)
                WHERE wl.user_id = :user_id
                  AND wl.date >= :date_from
                  AND wl.date <= :date_to
                  AND exercise_item.item ? 'exercise_id'
                  AND (:exercise_id IS NULL OR (exercise_item.item->>'exercise_id')::int = :exercise_id)
            ),
            limited_exercises AS (
                SELECT exercise_id
                FROM parsed_sets
                GROUP BY exercise_id
                ORDER BY MAX(workout_date) DESC, exercise_id
                LIMIT :max_exercises
            ),
            filtered_sets AS (
                SELECT ps.*
                FROM parsed_sets ps
                JOIN limited_exercises le ON le.exercise_id = ps.exercise_id
            )
        """
        params = {
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
            "exercise_id": exercise_id,
            "max_exercises": max_exercises,
            "max_data_points": max_data_points,
        }
        result = await self.db.execute(
            text(
                parsed_sets_cte
                + """
                , ranked_sets AS (
                    SELECT
                        exercise_id,
                        workout_date,
                        weight,
                        reps,
                        ROW_NUMBER() OVER (
                            PARTITION BY exercise_id, workout_date
                            ORDER BY weight DESC NULLS LAST, reps DESC NULLS LAST
                        ) AS rn
                    FROM filtered_sets
                ),
                ranked_by_exercise AS (
                    SELECT
                        exercise_id,
                        workout_date,
                        weight,
                        reps,
                        ROW_NUMBER() OVER (
                            PARTITION BY exercise_id
                            ORDER BY workout_date DESC
                        ) AS ex_rn
                    FROM ranked_sets
                    WHERE rn = 1
                )
                SELECT exercise_id, workout_date, weight AS max_weight, reps
                FROM ranked_by_exercise
                WHERE ex_rn <= :max_data_points
                ORDER BY exercise_id, workout_date
                """
            ),
            params,
        )
        return result.mappings().all()

    async def get_exercise_progress_best_performance(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        exercise_id: Optional[int],
        max_exercises: int,
    ) -> List[Dict[str, Any]]:
        parsed_sets_cte = """
            WITH parsed_sets AS (
                SELECT
                    wl.date AS workout_date,
                    (exercise_item.item->>'exercise_id')::int AS exercise_id,
                    COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                    NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                    NULLIF(set_item.item->>'reps', '')::int AS reps
                FROM workout_logs wl
                CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                CROSS JOIN LATERAL jsonb_array_elements(
                    COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                ) AS set_item(item)
                WHERE wl.user_id = :user_id
                  AND wl.date >= :date_from
                  AND wl.date <= :date_to
                  AND exercise_item.item ? 'exercise_id'
                  AND (:exercise_id IS NULL OR (exercise_item.item->>'exercise_id')::int = :exercise_id)
            ),
            limited_exercises AS (
                SELECT exercise_id
                FROM parsed_sets
                GROUP BY exercise_id
                ORDER BY MAX(workout_date) DESC, exercise_id
                LIMIT :max_exercises
            ),
            filtered_sets AS (
                SELECT ps.*
                FROM parsed_sets ps
                JOIN limited_exercises le ON le.exercise_id = ps.exercise_id
            )
        """
        params = {
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
            "exercise_id": exercise_id,
            "max_exercises": max_exercises,
        }
        result = await self.db.execute(
            text(
                parsed_sets_cte
                + """
                , ranked_best AS (
                    SELECT
                        exercise_id,
                        workout_date,
                        weight,
                        reps,
                        ROW_NUMBER() OVER (
                            PARTITION BY exercise_id
                            ORDER BY weight DESC NULLS LAST, workout_date ASC
                        ) AS rn
                    FROM filtered_sets
                    WHERE weight IS NOT NULL
                )
                SELECT exercise_id, workout_date, weight, reps
                FROM ranked_best
                WHERE rn = 1
                """
            ),
            params,
        )
        return result.mappings().all()

    async def get_calendar_day_stats(
        self,
        user_id: int,
        first_day: date,
        last_day: date,
    ) -> List[Any]:
        base_filters = and_(
            WorkoutLog.user_id == user_id,
            WorkoutLog.date >= first_day,
            WorkoutLog.date <= last_day,
        )
        result = await self.db.execute(
            select(
                WorkoutLog.date.label("workout_date"),
                func.count(WorkoutLog.id).label("workout_count"),
                func.coalesce(func.sum(WorkoutLog.duration), 0).label("total_duration"),
                func.bool_or(
                    or_(
                        WorkoutLog.glucose_before.isnot(None),
                        WorkoutLog.glucose_after.isnot(None),
                    )
                ).label("glucose_logged"),
            )
            .where(base_filters)
            .group_by(WorkoutLog.date)
        )
        return result.all()

    async def get_calendar_day_tags(
        self,
        user_id: int,
        first_day: date,
        last_day: date,
    ) -> List[Any]:
        base_filters = and_(
            WorkoutLog.user_id == user_id,
            WorkoutLog.date >= first_day,
            WorkoutLog.date <= last_day,
        )
        tag_elements = func.jsonb_array_elements_text(WorkoutLog.tags).table_valued("tag").alias("tag_elements")
        result = await self.db.execute(
            select(
                WorkoutLog.date.label("workout_date"),
                func.array_remove(
                    func.array_agg(func.distinct(tag_elements.c.tag)),
                    None,
                ).label("workout_types"),
            )
            .select_from(WorkoutLog)
            .join(tag_elements, true(), isouter=True)
            .where(base_filters)
            .group_by(WorkoutLog.date)
        )
        return result.all()

    async def get_wellness_dates_in_range(
        self,
        user_id: int,
        first_day: date,
        last_day: date,
    ) -> List[date]:
        result = await self.db.execute(
            select(DailyWellness.date).where(
                and_(
                    DailyWellness.user_id == user_id,
                    DailyWellness.date >= first_day,
                    DailyWellness.date <= last_day,
                )
            )
        )
        return [row[0] for row in result.all()]

    async def get_summary_totals(self, user_id: int, date_from: date) -> Any:
        result = await self.db.execute(
            select(
                func.count(WorkoutLog.id).label("total_workouts"),
                func.coalesce(func.sum(WorkoutLog.duration), 0).label("total_duration"),
            ).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                )
            )
        )
        return result.one()

    async def get_total_unique_exercises(self, user_id: int, date_from: date) -> int:
        exercise_elements = func.jsonb_array_elements(WorkoutLog.exercises).table_valued("item").alias("exercise_elements")
        exercise_id_expr = cast(
            exercise_elements.c.item.op("->>")("exercise_id"),
            Integer,
        )
        result = await self.db.execute(
            select(func.count(func.distinct(exercise_id_expr)).label("total_exercises"))
            .select_from(WorkoutLog)
            .join(exercise_elements, true())
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                )
            )
            .where(exercise_elements.c.item.op("?")("exercise_id"))
        )
        return int(result.scalar() or 0)

    async def get_workout_dates(self, user_id: int, date_from: date) -> List[date]:
        result = await self.db.execute(
            select(WorkoutLog.date)
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                )
            )
            .group_by(WorkoutLog.date)
            .order_by(WorkoutLog.date)
        )
        return [row[0] for row in result.all()]

    async def get_favorite_exercises(
        self,
        user_id: int,
        date_from: date,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        exercise_elements = func.jsonb_array_elements(WorkoutLog.exercises).table_valued("item").alias("exercise_elements")
        exercise_id_expr = cast(
            exercise_elements.c.item.op("->>")("exercise_id"),
            Integer,
        )
        exercise_name_expr = func.coalesce(
            func.nullif(exercise_elements.c.item.op("->>")("name"), ""),
            literal("Unknown"),
        )

        result = await self.db.execute(
            select(
                exercise_id_expr.label("exercise_id"),
                exercise_name_expr.label("name"),
                func.count().label("count"),
            )
            .select_from(WorkoutLog)
            .join(exercise_elements, true())
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                )
            )
            .where(exercise_elements.c.item.op("?")("exercise_id"))
            .group_by(exercise_id_expr, exercise_name_expr)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return [
            {
                "exercise_id": int(row.exercise_id),
                "name": row.name,
                "count": int(row.count),
            }
            for row in result.all()
        ]

    async def get_muscle_imbalance_signals(self, user_id: int) -> Optional[Dict[str, Any]]:
        row = (
            await self.db.execute(
                text(
                    """
                    SELECT *
                    FROM muscle_imbalance_signals_by_user
                    WHERE user_id = :user_id
                    LIMIT 1
                    """
                ),
                {"user_id": str(user_id)},
            )
        ).mappings().first()
        return dict(row) if row else None
