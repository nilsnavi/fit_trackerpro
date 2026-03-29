from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.analytics_repository import AnalyticsRepository
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    CalendarDayEntry,
    DataExportRequest,
    DataExportResponse,
    ExerciseProgressData,
    ExerciseProgressResponse,
    MuscleImbalanceSignalsResponse,
    MuscleLoadEntry,
    MuscleLoadTableResponse,
    RecoveryStateRecalculateResponse,
    RecoveryStateResponse,
    TrainingLoadDailyEntry,
    TrainingLoadDailyTableResponse,
    WorkoutCalendarResponse,
)
from app.utils.cache import (
    get_cache_json,
    invalidate_user_analytics_cache,
    set_cache_json,
)
from app.settings import settings
from app.utils.feature_flags import is_feature_enabled


class AnalyticsValidationError(Exception):
    pass


class AnalyticsNotFoundError(Exception):
    pass


class AnalyticsUnavailableError(Exception):
    pass


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = AnalyticsRepository(db)

    @staticmethod
    def _build_cache_key(endpoint: str, user_id: int, **kwargs: Any) -> str:
        parts = [f"analytics:{endpoint}:u:{user_id}"]
        for k in sorted(kwargs.keys()):
            parts.append(f"{k}:{kwargs[k]}")
        return "|".join(parts)

    @staticmethod
    def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
        return max(lower, min(upper, value))

    @staticmethod
    def _resolve_date_range(
        date_from: Optional[date],
        date_to: Optional[date],
        default_days: int = 29,
    ) -> tuple[date, date]:
        effective_date_to = date_to or date.today()
        effective_date_from = date_from or (effective_date_to - timedelta(days=default_days))
        if effective_date_from > effective_date_to:
            raise AnalyticsValidationError("date_from cannot be greater than date_to")
        return effective_date_from, effective_date_to

    async def get_daily_training_load(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[Dict[str, Any]]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "training-load-daily",
            user_id,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        rows = await self.repository.list_training_load_daily(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        payload = [
            TrainingLoadDailyEntry(
                id=row.id,
                user_id=row.user_id,
                date=row.date,
                volume=float(row.volume or 0),
                fatigue_score=float(row.fatigue_score or 0),
                avg_rpe=float(row.avg_rpe) if row.avg_rpe is not None else None,
            ).model_dump(mode="json", by_alias=True)
            for row in rows
        ]
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_daily_training_load_table(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> Dict[str, Any]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "training-load-daily-table",
            user_id,
            page=page,
            page_size=page_size,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        total = await self.repository.count_training_load_daily(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        rows = await self.repository.list_training_load_daily_paginated(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
            page=page,
            page_size=page_size,
        )
        model = TrainingLoadDailyTableResponse(
            items=[
                TrainingLoadDailyEntry(
                    id=row.id,
                    user_id=row.user_id,
                    date=row.date,
                    volume=float(row.volume or 0),
                    fatigue_score=float(row.fatigue_score or 0),
                    avg_rpe=float(row.avg_rpe) if row.avg_rpe is not None else None,
                )
                for row in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        payload = model.model_dump(mode="json", by_alias=True)
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_muscle_load(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[Dict[str, Any]]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "muscle-load",
            user_id,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        rows = await self.repository.list_muscle_load(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        payload = [
            MuscleLoadEntry(
                id=row.id,
                user_id=row.user_id,
                muscle_group=row.muscle_group,
                date=row.date,
                load_score=float(row.load_score or 0),
            ).model_dump(mode="json", by_alias=True)
            for row in rows
        ]
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_muscle_load_table(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
        muscle_group: Optional[str],
    ) -> Dict[str, Any]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "muscle-load-table",
            user_id,
            page=page,
            page_size=page_size,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
            muscle_group=muscle_group or "all",
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        total = await self.repository.count_muscle_load(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
            muscle_group=muscle_group,
        )
        rows = await self.repository.list_muscle_load_paginated(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
            page=page,
            page_size=page_size,
            muscle_group=muscle_group,
        )
        model = MuscleLoadTableResponse(
            items=[
                MuscleLoadEntry(
                    id=row.id,
                    user_id=row.user_id,
                    muscle_group=row.muscle_group,
                    date=row.date,
                    load_score=float(row.load_score or 0),
                )
                for row in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        payload = model.model_dump(mode="json", by_alias=True)
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_recovery_state(self, user_id: int) -> Dict[str, Any]:
        cache_key = self._build_cache_key("recovery-state", user_id)
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        state = await self.repository.get_recovery_state(user_id)
        if not state:
            raise AnalyticsNotFoundError("Recovery state not found")

        payload = RecoveryStateResponse(
            id=state.id,
            user_id=state.user_id,
            fatigue_level=int(state.fatigue_level),
            readiness_score=float(state.readiness_score or 0),
        ).model_dump(mode="json", by_alias=True)
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def recalculate_recovery_state(
        self,
        user_id: int,
        target_date: Optional[date],
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> Dict[str, Any]:
        if target_date and (date_from or date_to):
            raise AnalyticsValidationError("Use either target_date or date_from/date_to")

        if target_date:
            effective_date_from = target_date
            effective_date_to = target_date
        else:
            effective_date_to = date_to or date.today()
            effective_date_from = date_from or effective_date_to

        if effective_date_from > effective_date_to:
            raise AnalyticsValidationError("date_from cannot be greater than date_to")

        recalculated_for_date = effective_date_to
        training = await self.repository.get_training_load_for_day(user_id, recalculated_for_date)
        fatigue_score = float(training.fatigue_score) if training and training.fatigue_score is not None else 0.0
        fatigue_level = int(round(self._clamp(fatigue_score / 5.0)))

        latest_wellness = await self.repository.get_latest_wellness_on_or_before(
            user_id=user_id,
            target_date=recalculated_for_date,
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
        state = await self.repository.upsert_recovery_state(
            user_id=user_id,
            fatigue_level=fatigue_level,
            readiness_score=readiness_score,
        )
        await self.db.commit()
        await self.db.refresh(state)
        await invalidate_user_analytics_cache(user_id)

        model = RecoveryStateRecalculateResponse(
            id=state.id,
            user_id=state.user_id,
            fatigue_level=int(state.fatigue_level),
            readiness_score=float(state.readiness_score or 0),
            recalculated_for_date=recalculated_for_date,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        return model.model_dump(mode="json", by_alias=True)

    async def get_exercise_progress(
        self,
        user_id: int,
        exercise_id: Optional[int],
        period: str,
        max_exercises: int,
        max_data_points: int,
    ) -> List[Dict[str, Any]]:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650}
        days = days_map.get(period, 30)
        date_from = date.today() - timedelta(days=days)

        cache_key = self._build_cache_key(
            "progress",
            user_id,
            exercise_id=exercise_id or "all",
            period=period,
            max_exercises=max_exercises,
            max_data_points=max_data_points,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        summary_rows = await self.repository.get_exercise_progress_summary(
            user_id=user_id,
            date_from=date_from,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
        )
        if not summary_rows:
            return []

        data_points_rows = await self.repository.get_exercise_progress_data_points(
            user_id=user_id,
            date_from=date_from,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
            max_data_points=max_data_points,
        )
        best_perf_rows = await self.repository.get_exercise_progress_best_performance(
            user_id=user_id,
            date_from=date_from,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
        )

        data_points_by_ex: Dict[int, List[Dict[str, Any]]] = {}
        for row in data_points_rows:
            ex_id = int(row["exercise_id"])
            point = {
                "date": row["workout_date"].isoformat(),
                "max_weight": float(row["max_weight"]) if row["max_weight"] is not None else None,
                "reps": int(row["reps"]) if row["reps"] is not None else None,
            }
            data_points_by_ex.setdefault(ex_id, []).append(point)

        best_perf_by_ex: Dict[int, Dict[str, Any]] = {}
        for row in best_perf_rows:
            best_perf_by_ex[int(row["exercise_id"])] = {
                "date": row["workout_date"].isoformat(),
                "weight": float(row["weight"]) if row["weight"] is not None else None,
                "reps": int(row["reps"]) if row["reps"] is not None else None,
            }

        responses: List[ExerciseProgressResponse] = []
        for row in summary_rows:
            ex_id = int(row["exercise_id"])
            data_points = data_points_by_ex.get(ex_id, [])
            weights = [p["max_weight"] for p in data_points if p["max_weight"] is not None]

            progress_pct = None
            if len(weights) >= 2 and weights[0] > 0:
                progress_pct = round(((weights[-1] - weights[0]) / weights[0]) * 100, 1)

            avg_weight_val = float(row["avg_weight"]) if row["avg_weight"] is not None else None
            summary = ExerciseProgressData(
                exercise_id=ex_id,
                exercise_name=row["exercise_name"],
                total_sets=int(row["total_sets"]),
                total_reps=int(row["total_reps"] or 0),
                max_weight=float(row["max_weight"]) if row["max_weight"] is not None else None,
                avg_weight=round(avg_weight_val, 1) if avg_weight_val else None,
                first_date=row["first_date"],
                last_date=row["last_date"],
                progress_percentage=progress_pct,
            )
            responses.append(
                ExerciseProgressResponse(
                    exercise_id=ex_id,
                    exercise_name=row["exercise_name"],
                    period=period,
                    data_points=data_points,
                    summary=summary,
                    best_performance=best_perf_by_ex.get(ex_id),
                )
            )

        payload = [item.model_dump(mode="json") for item in responses]
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_workout_calendar(
        self,
        user_id: int,
        year: int,
        month: int,
    ) -> Dict[str, Any]:
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        cache_key = self._build_cache_key(
            "calendar",
            user_id,
            year=year,
            month=month,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        day_stats_rows = await self.repository.get_calendar_day_stats(user_id, first_day, last_day)
        day_tags_rows = await self.repository.get_calendar_day_tags(user_id, first_day, last_day)
        wellness_dates = set(await self.repository.get_wellness_dates_in_range(user_id, first_day, last_day))

        day_stats_map = {row.workout_date: row for row in day_stats_rows}
        day_tags_map = {row.workout_date: (row.workout_types or []) for row in day_tags_rows}

        days: List[CalendarDayEntry] = []
        current = first_day
        while current <= last_day:
            day_stats = day_stats_map.get(current)
            workout_count = int(day_stats.workout_count) if day_stats else 0
            total_duration = int(day_stats.total_duration) if day_stats else 0
            glucose_logged = bool(day_stats.glucose_logged) if day_stats else False
            days.append(
                CalendarDayEntry(
                    date=current,
                    has_workout=workout_count > 0,
                    workout_count=workout_count,
                    total_duration=total_duration,
                    workout_types=day_tags_map.get(current, []),
                    glucose_logged=glucose_logged,
                    wellness_logged=current in wellness_dates,
                )
            )
            current += timedelta(days=1)

        total_workouts = sum(d.workout_count for d in days)
        total_duration = sum(d.total_duration for d in days)
        active_days = sum(1 for d in days if d.has_workout)
        response = WorkoutCalendarResponse(
            year=year,
            month=month,
            days=days,
            summary={
                "total_workouts": total_workouts,
                "total_duration": total_duration,
                "active_days": active_days,
                "rest_days": len(days) - active_days,
            },
        )
        payload = response.model_dump(mode="json")
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def export_data(self, export_request: DataExportRequest) -> Dict[str, Any]:
        export_id = f"exp_{uuid.uuid4().hex[:12]}"
        payload = DataExportResponse(
            export_id=export_id,
            status="pending",
            format=export_request.format,
            download_url=None,
            expires_at=datetime.utcnow() + timedelta(days=1),
            requested_at=datetime.utcnow(),
            file_size=None,
        )
        return payload.model_dump(mode="json")

    async def get_export_status(self, export_id: str) -> Dict[str, Any]:
        raise AnalyticsNotFoundError("Export not found or expired")

    async def get_analytics_summary(self, user_id: int, period: str) -> Dict[str, Any]:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 36500}
        days = days_map.get(period, 30)
        date_from = date.today() - timedelta(days=days)

        muscle_signals_enabled = await is_feature_enabled(self.db, "muscle_imbalance_signals", default=False)
        cache_key = self._build_cache_key(
            "summary",
            user_id,
            period=period,
            muscle_signals=muscle_signals_enabled,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return cached

        summary_row = await self.repository.get_summary_totals(user_id=user_id, date_from=date_from)
        total_workouts = int(summary_row.total_workouts or 0)

        if total_workouts == 0:
            empty_payload = {
                "total_workouts": 0,
                "total_duration": 0,
                "total_exercises": 0,
                "current_streak": 0,
                "longest_streak": 0,
                "personal_records": [],
                "favorite_exercises": [],
                "weekly_average": 0.0,
                "monthly_average": 0.0,
                "muscle_imbalance_signals": None,
            }
            await set_cache_json(
                cache_key,
                empty_payload,
                ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
            )
            return empty_payload

        total_duration = int(summary_row.total_duration or 0)
        total_exercises = await self.repository.get_total_unique_exercises(user_id=user_id, date_from=date_from)
        workout_dates = await self.repository.get_workout_dates(user_id=user_id, date_from=date_from)

        current_streak = 0
        longest_streak = 0
        today = date.today()
        yesterday = today - timedelta(days=1)

        if workout_dates and workout_dates[-1] in [today, yesterday]:
            for i in range(len(workout_dates) - 1, -1, -1):
                if i == len(workout_dates) - 1:
                    current_streak = 1
                elif (workout_dates[i + 1] - workout_dates[i]).days == 1:
                    current_streak += 1
                else:
                    break

        if workout_dates:
            temp_streak = 1
            for i in range(1, len(workout_dates)):
                if (workout_dates[i] - workout_dates[i - 1]).days == 1:
                    temp_streak += 1
                else:
                    longest_streak = max(longest_streak, temp_streak)
                    temp_streak = 1
            longest_streak = max(longest_streak, temp_streak)

        favorite_exercises = await self.repository.get_favorite_exercises(
            user_id=user_id,
            date_from=date_from,
            limit=5,
        )

        weeks = max(1, days / 7)
        months = max(1, days / 30)

        muscle_imbalance_signals = None
        if muscle_signals_enabled:
            try:
                muscle_imbalance_signals = await self.repository.get_muscle_imbalance_signals(user_id)
            except SQLAlchemyError:
                muscle_imbalance_signals = None

        payload = AnalyticsSummaryResponse(
            total_workouts=total_workouts,
            total_duration=total_duration,
            total_exercises=total_exercises,
            current_streak=current_streak,
            longest_streak=longest_streak,
            personal_records=[],
            favorite_exercises=favorite_exercises,
            weekly_average=round(total_workouts / weeks, 1),
            monthly_average=round(total_workouts / months, 1),
            muscle_imbalance_signals=muscle_imbalance_signals,
        ).model_dump(mode="json")
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return payload

    async def get_muscle_imbalance_signals(self, user_id: int) -> MuscleImbalanceSignalsResponse:
        muscle_signals_enabled = await is_feature_enabled(self.db, "muscle_imbalance_signals", default=False)
        if not muscle_signals_enabled:
            raise AnalyticsNotFoundError("Muscle imbalance signals are disabled")

        cache_key = self._build_cache_key("muscle-signals", user_id)
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return MuscleImbalanceSignalsResponse.model_validate(cached)

        try:
            signals = await self.repository.get_muscle_imbalance_signals(user_id)
        except SQLAlchemyError as exc:
            raise AnalyticsUnavailableError("Muscle imbalance signals are temporarily unavailable") from exc

        dto = MuscleImbalanceSignalsResponse(available=bool(signals), signals=signals or {})
        await set_cache_json(
            cache_key,
            dto.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return dto
