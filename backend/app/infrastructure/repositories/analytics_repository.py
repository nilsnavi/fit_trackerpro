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

    async def get_workout_dates(
        self,
        user_id: int,
        date_from: date,
        date_to: Optional[date] = None,
    ) -> List[date]:
        filters = [
            WorkoutLog.user_id == user_id,
            WorkoutLog.date >= date_from,
        ]
        if date_to is not None:
            filters.append(WorkoutLog.date <= date_to)
        result = await self.db.execute(
            select(WorkoutLog.date)
            .where(and_(*filters))
            .group_by(WorkoutLog.date)
            .order_by(WorkoutLog.date)
        )
        return [row[0] for row in result.all()]

    async def get_earliest_workout_date(self, user_id: int) -> Optional[date]:
        result = await self.db.execute(
            select(func.min(WorkoutLog.date)).where(WorkoutLog.user_id == user_id)
        )
        row = result.scalar()
        return row if row is not None else None

    async def count_workouts_between(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> int:
        result = await self.db.execute(
            select(func.count(WorkoutLog.id)).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                    WorkoutLog.date <= date_to,
                )
            )
        )
        return int(result.scalar() or 0)

    async def sum_duration_minutes_between(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(WorkoutLog.duration), 0)).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                    WorkoutLog.date <= date_to,
                )
            )
        )
        return int(result.scalar() or 0)

    async def get_workout_counts_by_day(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[tuple[date, int]]:
        result = await self.db.execute(
            select(WorkoutLog.date, func.count(WorkoutLog.id))
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                    WorkoutLog.date <= date_to,
                )
            )
            .group_by(WorkoutLog.date)
            .order_by(WorkoutLog.date)
        )
        return [(row[0], int(row[1])) for row in result.all()]

    async def get_favorite_exercises(
        self,
        user_id: int,
        date_from: date,
        limit: int = 5,
        date_to: Optional[date] = None,
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
                    *(
                        [WorkoutLog.date <= date_to]
                        if date_to is not None
                        else []
                    ),
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

    async def get_progress_insights_summary(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> Dict[str, Any]:
        result = await self.db.execute(
            text(
                """
                WITH parsed_sets AS (
                    SELECT
                        wl.id AS workout_id,
                        wl.date AS workout_date,
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
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                ),
                workout_totals AS (
                    SELECT
                        COUNT(DISTINCT wl.id) AS total_workouts,
                        COUNT(DISTINCT wl.date) AS active_days
                    FROM workout_logs wl
                    WHERE wl.user_id = :user_id
                      AND wl.date >= :date_from
                      AND wl.date <= :date_to
                      AND COALESCE(wl.duration, 0) > 0
                )
                SELECT
                    wt.total_workouts,
                    wt.active_days,
                    COALESCE(COUNT(ps.workout_id), 0) AS total_sets,
                    COALESCE(SUM(ps.reps), 0) AS total_reps,
                    COALESCE(SUM(COALESCE(ps.weight, 0) * COALESCE(ps.reps, 0)), 0) AS total_volume
                FROM workout_totals wt
                LEFT JOIN parsed_sets ps ON true
                GROUP BY wt.total_workouts, wt.active_days
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        row = result.mappings().first()
        return dict(row) if row else {
            "total_workouts": 0,
            "active_days": 0,
            "total_sets": 0,
            "total_reps": 0,
            "total_volume": 0,
        }

    async def get_progress_volume_trend(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                WITH parsed_sets AS (
                    SELECT
                        wl.id AS workout_id,
                        wl.date AS workout_date,
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
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                )
                SELECT
                    ps.workout_date AS date,
                    COUNT(DISTINCT ps.workout_id) AS workout_count,
                    COUNT(*) AS total_sets,
                    COALESCE(SUM(ps.reps), 0) AS total_reps,
                    COALESCE(SUM(COALESCE(ps.weight, 0) * COALESCE(ps.reps, 0)), 0) AS total_volume
                FROM parsed_sets ps
                GROUP BY ps.workout_date
                ORDER BY ps.workout_date ASC
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_progress_frequency_trend(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                WITH workout_days AS (
                    SELECT
                        wl.date AS workout_date,
                        date_trunc('week', wl.date::timestamp)::date AS week_start,
                        (date_trunc('week', wl.date::timestamp)::date + INTERVAL '6 days')::date AS week_end,
                        COUNT(*) AS workout_count
                    FROM workout_logs wl
                    WHERE wl.user_id = :user_id
                      AND wl.date >= :date_from
                      AND wl.date <= :date_to
                      AND COALESCE(wl.duration, 0) > 0
                    GROUP BY wl.date, week_start, week_end
                )
                SELECT
                    wd.week_start,
                    wd.week_end,
                    COUNT(*) AS active_days,
                    COALESCE(SUM(wd.workout_count), 0) AS workout_count
                FROM workout_days wd
                GROUP BY wd.week_start, wd.week_end
                ORDER BY wd.week_start ASC
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_performance_overview_summary(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> Dict[str, Any]:
        result = await self.db.execute(
            text(
                """
                WITH parsed_sets AS (
                    SELECT
                        wl.id AS workout_id,
                        wl.date AS workout_date,
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
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                ),
                daily AS (
                    SELECT
                        ps.workout_date,
                        COUNT(DISTINCT ps.workout_id) AS workout_count,
                        COALESCE(SUM(COALESCE(ps.weight, 0) * COALESCE(ps.reps, 0)), 0) AS total_volume,
                        MAX(
                            CASE
                                WHEN ps.weight IS NOT NULL AND ps.reps IS NOT NULL AND ps.reps > 0
                                THEN ps.weight * (1 + ps.reps::double precision / 30.0)
                                ELSE NULL
                            END
                        ) AS best_estimated_1rm
                    FROM parsed_sets ps
                    GROUP BY ps.workout_date
                )
                SELECT
                    (
                        SELECT COUNT(DISTINCT wl.id)
                        FROM workout_logs wl
                        WHERE wl.user_id = :user_id
                          AND wl.date >= :date_from
                          AND wl.date <= :date_to
                          AND COALESCE(wl.duration, 0) > 0
                    ) AS total_workouts,
                    COALESCE((SELECT COUNT(*) FROM daily), 0) AS active_days,
                    COALESCE((SELECT SUM(d.total_volume) FROM daily d), 0) AS total_volume,
                    (SELECT d.best_estimated_1rm FROM daily d ORDER BY d.workout_date ASC LIMIT 1) AS baseline_estimated_1rm,
                    (SELECT d.best_estimated_1rm FROM daily d ORDER BY d.workout_date DESC LIMIT 1) AS current_estimated_1rm
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        row = result.mappings().first()
        return dict(row) if row else {
            "total_workouts": 0,
            "active_days": 0,
            "total_volume": 0,
            "baseline_estimated_1rm": None,
            "current_estimated_1rm": None,
        }

    async def get_performance_overview_trend(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                WITH parsed_sets AS (
                    SELECT
                        wl.id AS workout_id,
                        wl.date AS workout_date,
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
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                )
                SELECT
                    ps.workout_date AS date,
                    COUNT(DISTINCT ps.workout_id) AS workout_count,
                    COALESCE(SUM(COALESCE(ps.weight, 0) * COALESCE(ps.reps, 0)), 0) AS total_volume,
                    MAX(
                        CASE
                            WHEN ps.weight IS NOT NULL AND ps.reps IS NOT NULL AND ps.reps > 0
                            THEN ps.weight * (1 + ps.reps::double precision / 30.0)
                            ELSE NULL
                        END
                    ) AS best_estimated_1rm
                FROM parsed_sets ps
                GROUP BY ps.workout_date
                ORDER BY ps.workout_date ASC
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_progress_best_sets(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                WITH parsed_sets AS (
                    SELECT
                        wl.date AS workout_date,
                        (exercise_item.item->>'exercise_id')::int AS exercise_id,
                        COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                        NULLIF(set_item.item->>'set_number', '')::int AS set_number,
                        NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                        NULLIF(set_item.item->>'reps', '')::int AS reps,
                        COALESCE(NULLIF(set_item.item->>'weight', '')::double precision, 0)
                            * COALESCE(NULLIF(set_item.item->>'reps', '')::int, 0) AS volume
                    FROM workout_logs wl
                    CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                    CROSS JOIN LATERAL jsonb_array_elements(
                        COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                    ) AS set_item(item)
                    WHERE wl.user_id = :user_id
                      AND wl.date >= :date_from
                      AND wl.date <= :date_to
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                      AND exercise_item.item ? 'exercise_id'
                )
                SELECT
                    exercise_id,
                    exercise_name,
                    workout_date AS date,
                    set_number,
                    weight,
                    reps,
                    volume
                FROM parsed_sets
                ORDER BY volume DESC, weight DESC NULLS LAST, reps DESC NULLS LAST, workout_date DESC
                LIMIT :limit
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
                "limit": limit,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_progress_pr_events(
        self,
        user_id: int,
        date_from: date,
        date_to: date,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
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
                      AND wl.date <= :date_to
                      AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                      AND exercise_item.item ? 'exercise_id'
                      AND NULLIF(set_item.item->>'weight', '')::double precision IS NOT NULL
                ),
                day_best AS (
                    SELECT
                        exercise_id,
                        exercise_name,
                        workout_date,
                        weight,
                        reps,
                        ROW_NUMBER() OVER (
                            PARTITION BY exercise_id, workout_date
                            ORDER BY weight DESC NULLS LAST, reps DESC NULLS LAST
                        ) AS rn
                    FROM parsed_sets
                ),
                daily AS (
                    SELECT
                        exercise_id,
                        exercise_name,
                        workout_date,
                        weight,
                        reps
                    FROM day_best
                    WHERE rn = 1
                ),
                with_prev AS (
                    SELECT
                        d.*,
                        MAX(d.weight) OVER (
                            PARTITION BY d.exercise_id
                            ORDER BY d.workout_date
                            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                        ) AS previous_best_weight
                    FROM daily d
                )
                SELECT
                    exercise_id,
                    exercise_name,
                    workout_date AS date,
                    weight,
                    reps,
                    previous_best_weight,
                    (weight - previous_best_weight) AS improvement,
                    CASE
                        WHEN previous_best_weight IS NULL OR previous_best_weight = 0 THEN NULL
                        ELSE ((weight - previous_best_weight) / previous_best_weight) * 100
                    END AS improvement_pct,
                    (previous_best_weight IS NULL) AS is_first_entry
                FROM with_prev
                WHERE workout_date >= :date_from
                  AND (previous_best_weight IS NULL OR weight > previous_best_weight)
                ORDER BY workout_date DESC, weight DESC
                LIMIT :limit
                """
            ),
            {
                "user_id": user_id,
                "date_from": date_from,
                "date_to": date_to,
                "limit": limit,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_workout_post_summary(
        self,
        user_id: int,
        workout_id: int,
        limit_best_sets: int = 5,
    ) -> Optional[Dict[str, Any]]:
        workout_row = (
            await self.db.execute(
                text(
                    """
                                        SELECT id, date, duration, exercises, session_metrics
                    FROM workout_logs
                    WHERE user_id = :user_id
                      AND id = :workout_id
                    LIMIT 1
                    """
                ),
                {
                    "user_id": user_id,
                    "workout_id": workout_id,
                },
            )
        ).mappings().first()
        if not workout_row:
            return None

        totals_row = (
            await self.db.execute(
                text(
                    """
                    WITH parsed_sets AS (
                        SELECT
                            NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                            NULLIF(set_item.item->>'reps', '')::int AS reps
                        FROM workout_logs wl
                        CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                        CROSS JOIN LATERAL jsonb_array_elements(
                            COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                        ) AS set_item(item)
                        WHERE wl.user_id = :user_id
                          AND wl.id = :workout_id
                          AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                    )
                    SELECT
                        COUNT(*) AS total_sets,
                        COALESCE(SUM(reps), 0) AS total_reps,
                        COALESCE(SUM(COALESCE(weight, 0) * COALESCE(reps, 0)), 0) AS total_volume
                    FROM parsed_sets
                    """
                ),
                {
                    "user_id": user_id,
                    "workout_id": workout_id,
                },
            )
        ).mappings().first()

        best_sets = (
            await self.db.execute(
                text(
                    """
                    WITH parsed_sets AS (
                        SELECT
                            (exercise_item.item->>'exercise_id')::int AS exercise_id,
                            COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                            wl.date AS workout_date,
                            NULLIF(set_item.item->>'set_number', '')::int AS set_number,
                            NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                            NULLIF(set_item.item->>'reps', '')::int AS reps,
                            COALESCE(NULLIF(set_item.item->>'weight', '')::double precision, 0)
                                * COALESCE(NULLIF(set_item.item->>'reps', '')::int, 0) AS volume
                        FROM workout_logs wl
                        CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
                        CROSS JOIN LATERAL jsonb_array_elements(
                            COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
                        ) AS set_item(item)
                        WHERE wl.user_id = :user_id
                          AND wl.id = :workout_id
                          AND COALESCE((set_item.item->>'completed')::boolean, false) = true
                          AND exercise_item.item ? 'exercise_id'
                    )
                    SELECT
                        exercise_id,
                        exercise_name,
                        workout_date AS date,
                        set_number,
                        weight,
                        reps,
                        volume
                    FROM parsed_sets
                    ORDER BY volume DESC, weight DESC NULLS LAST, reps DESC NULLS LAST
                    LIMIT :limit_best_sets
                    """
                ),
                {
                    "user_id": user_id,
                    "workout_id": workout_id,
                    "limit_best_sets": limit_best_sets,
                },
            )
        ).mappings().all()

        return {
            "workout": dict(workout_row),
            "totals": dict(totals_row) if totals_row else {
                "total_sets": 0,
                "total_reps": 0,
                "total_volume": 0,
            },
            "best_sets": [dict(row) for row in best_sets],
        }
