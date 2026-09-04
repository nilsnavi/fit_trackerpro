from __future__ import annotations

import calendar
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, List, Optional

from pydantic import TypeAdapter
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.session_metrics import build_session_insights, compute_session_metrics
from app.domain.exceptions import (
    AnalyticsNotFoundError,
    AnalyticsUnavailableError,
    AnalyticsValidationError,
)
from app.infrastructure.cache import (
    get_cache_json,
    invalidate_user_analytics_cache,
    set_cache_json,
)
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.analytics_repository import AnalyticsRepository
from app.infrastructure.repositories.feature_flags_repository import FeatureFlagsRepository
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsIntensityWeekPoint,
    AnalyticsPerformanceOverviewResponse,
    AnalyticsPerformanceTrendPoint,
    AnalyticsSummaryResponse,
    AnalyticsWeeklyChartPoint,
    CalendarDayEntry,
    DataExportRequest,
    DataExportResponse,
    ExerciseBestPerformance,
    ExerciseProgressData,
    ExerciseProgressDataPoint,
    ExerciseProgressResponse,
    FavoriteExercise,
    MuscleImbalanceSignalsDetail,
    MuscleImbalanceSignalsResponse,
    MuscleLoadEntry,
    MuscleLoadTableResponse,
    ProgressInsightsBestSetItem,
    ProgressInsightsFrequencyPoint,
    ProgressInsightsPRItem,
    ProgressInsightsResponse,
    ProgressInsightsSummary,
    ProgressInsightsVolumePoint,
    RecoveryStateRecalculateResponse,
    RecoveryStateResponse,
    TrainingLoadDailyEntry,
    TrainingLoadDailyTableResponse,
    WorkoutCalendarResponse,
    WorkoutCalendarSummary,
    WorkoutPostSummaryResponse,
    WorkoutSessionInsightItem,
)
from app.schemas.enums import DataExportStatus
from app.settings import settings


def _intensity_safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _intensity_parse_datetime(value: object) -> Optional[datetime]:
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


def _iter_completed_sets_from_exercises(exercises: Any) -> List[dict]:
    out: list[dict] = []
    if not isinstance(exercises, list):
        return out
    for ex in exercises:
        if not isinstance(ex, dict):
            continue
        sets = ex.get("sets_completed")
        if not isinstance(sets, list):
            continue
        for raw in sets:
            if isinstance(raw, dict) and bool(raw.get("completed", True)):
                out.append(raw)
    return out


def _monday_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def compute_intensity_metrics_from_logs(
    workout_rows: List[tuple[int, date, list[Any]]],
) -> dict[str, Any]:
    """Derive RPE/rest/TUT/intensity aggregates from workout_logs.exercises JSON."""
    workout_rpe_lists: dict[int, list[float]] = defaultdict(list)
    all_rpe: list[float] = []
    rest_values: list[float] = []
    tut_total = 0.0
    completed_sets = 0

    for wid, _wdate, exercises in workout_rows:
        for s in _iter_completed_sets_from_exercises(exercises):
            completed_sets += 1
            rpe = _intensity_safe_float(s.get("rpe"))
            if rpe is not None and 0.0 <= rpe <= 10.0:
                all_rpe.append(rpe)
                workout_rpe_lists[wid].append(rpe)
            rest = _intensity_safe_float(s.get("actual_rest_seconds"))
            if rest is not None and rest >= 0:
                rest_values.append(rest)
            st = _intensity_parse_datetime(s.get("started_at"))
            en = _intensity_parse_datetime(s.get("completed_at"))
            if st is not None and en is not None and en >= st:
                tut_total += (en - st).total_seconds()

    per_workout_avgs: list[float] = []
    for _wid, rlist in workout_rpe_lists.items():
        per_workout_avgs.append(sum(rlist) / len(rlist))
    avg_rpe_per_workout = (
        round(sum(per_workout_avgs) / len(per_workout_avgs), 2) if per_workout_avgs else None
    )

    avg_rest = round(sum(rest_values) / len(rest_values), 2) if rest_values else None
    avg_rest_minutes = (avg_rest / 60.0) if avg_rest is not None and avg_rest > 0 else None

    intensity_score = None
    if avg_rpe_per_workout is not None and avg_rest_minutes is not None and completed_sets > 0:
        intensity_score = round(float(avg_rpe_per_workout) * (completed_sets / avg_rest_minutes), 3)

    return {
        "avg_rpe_per_workout": avg_rpe_per_workout,
        "avg_rest_time_seconds": avg_rest,
        "total_time_under_tension_seconds": round(tut_total, 2) if tut_total > 0 else None,
        "intensity_score": intensity_score,
        "workouts_with_rpe_count": len(workout_rpe_lists),
    }


def compute_intensity_weekly_chart(
    workout_rows: List[tuple[int, date, list[Any]]],
    chart_start: date,
    chart_end: date,
) -> List[AnalyticsIntensityWeekPoint]:
    """One intensity score per ISO week that intersects the chart window."""
    by_week: dict[date, list[tuple[int, date, list[Any]]]] = defaultdict(list)
    for row in workout_rows:
        _wid, wdate, exercises = row
        if chart_start <= wdate <= chart_end:
            by_week[_monday_week_start(wdate)].append(row)

    points: list[AnalyticsIntensityWeekPoint] = []
    for week_start in sorted(by_week.keys()):
        metrics = compute_intensity_metrics_from_logs(by_week[week_start])
        points.append(
            AnalyticsIntensityWeekPoint(
                date=week_start,
                intensity_score=metrics.get("intensity_score"),
            )
        )
    return points


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
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

    @staticmethod
    def _resolve_period_days(period: str, default_days: int = 30) -> int:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650}
        return days_map.get(period, default_days)

    async def get_daily_training_load(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[TrainingLoadDailyEntry]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "training-load-daily",
            user_id,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return TypeAdapter(list[TrainingLoadDailyEntry]).validate_python(cached)

        rows = await self.repository.list_training_load_daily(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        items = [
            TrainingLoadDailyEntry(
                id=row.id,
                user_id=row.user_id,
                date=row.date,
                volume=float(row.volume or 0),
                fatigue_score=float(row.fatigue_score or 0),
                avg_rpe=float(row.avg_rpe) if row.avg_rpe is not None else None,
            )
            for row in rows
        ]
        payload = [i.model_dump(mode="json", by_alias=True) for i in items]
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return items

    async def get_daily_training_load_table(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> TrainingLoadDailyTableResponse:
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
            return TrainingLoadDailyTableResponse.model_validate(cached)

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
        payload = model.model_dump(mode="json")
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return model

    async def get_muscle_load(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[MuscleLoadEntry]:
        effective_date_from, effective_date_to = self._resolve_date_range(date_from, date_to)
        cache_key = self._build_cache_key(
            "muscle-load",
            user_id,
            date_from=effective_date_from.isoformat(),
            date_to=effective_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return TypeAdapter(list[MuscleLoadEntry]).validate_python(cached)

        rows = await self.repository.list_muscle_load(
            user_id=user_id,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )
        items = [
            MuscleLoadEntry(
                id=row.id,
                user_id=row.user_id,
                muscle_group=row.muscle_group,
                date=row.date,
                load_score=float(row.load_score or 0),
            )
            for row in rows
        ]
        payload = [i.model_dump(mode="json", by_alias=True) for i in items]
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return items

    async def get_muscle_load_table(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
        muscle_group: Optional[str],
    ) -> MuscleLoadTableResponse:
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
            return MuscleLoadTableResponse.model_validate(cached)

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
        payload = model.model_dump(mode="json")
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return model

    async def get_recovery_state(self, user_id: int) -> RecoveryStateResponse:
        cache_key = self._build_cache_key("recovery-state", user_id)
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return RecoveryStateResponse.model_validate(cached)

        state = await self.repository.get_recovery_state(user_id)
        if not state:
            raise AnalyticsNotFoundError("Recovery state not found")

        dto = RecoveryStateResponse(
            id=state.id,
            user_id=state.user_id,
            fatigue_level=int(state.fatigue_level),
            readiness_score=float(state.readiness_score or 0),
        )
        await set_cache_json(
            cache_key,
            dto.model_dump(mode="json", by_alias=True),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return dto

    async def recalculate_recovery_state(
        self,
        user_id: int,
        target_date: Optional[date],
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> RecoveryStateRecalculateResponse:
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
        state = await self.repository.commit_recovery_state_recalculation(state)
        await invalidate_user_analytics_cache(user_id)

        return RecoveryStateRecalculateResponse(
            id=state.id,
            user_id=state.user_id,
            fatigue_level=int(state.fatigue_level),
            readiness_score=float(state.readiness_score or 0),
            recalculated_for_date=recalculated_for_date,
            date_from=effective_date_from,
            date_to=effective_date_to,
        )

    async def get_exercise_progress(
        self,
        user_id: int,
        exercise_id: Optional[int],
        period: str,
        max_exercises: int,
        max_data_points: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[ExerciseProgressResponse]:
        days = self._resolve_period_days(period)
        resolved_date_to = date_to or date.today()
        resolved_date_from = date_from or (resolved_date_to - timedelta(days=days))
        if resolved_date_from > resolved_date_to:
            raise AnalyticsValidationError("date_from cannot be greater than date_to")

        cache_key = self._build_cache_key(
            "progress",
            user_id,
            exercise_id=exercise_id or "all",
            period=period,
            date_from=resolved_date_from.isoformat(),
            date_to=resolved_date_to.isoformat(),
            max_exercises=max_exercises,
            max_data_points=max_data_points,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return TypeAdapter(list[ExerciseProgressResponse]).validate_python(cached)

        summary_rows = await self.repository.get_exercise_progress_summary(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
        )
        if not summary_rows:
            return []

        data_points_rows = await self.repository.get_exercise_progress_data_points(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
            max_data_points=max_data_points,
        )
        best_perf_rows = await self.repository.get_exercise_progress_best_performance(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            exercise_id=exercise_id,
            max_exercises=max_exercises,
        )

        data_points_by_ex: dict[int, list[ExerciseProgressDataPoint]] = {}
        for row in data_points_rows:
            ex_id = int(row["exercise_id"])
            point = ExerciseProgressDataPoint(
                date=row["workout_date"],
                max_weight=float(row["max_weight"]) if row["max_weight"] is not None else None,
                reps=int(row["reps"]) if row["reps"] is not None else None,
            )
            data_points_by_ex.setdefault(ex_id, []).append(point)

        best_perf_by_ex: dict[int, ExerciseBestPerformance] = {}
        for row in best_perf_rows:
            best_perf_by_ex[int(row["exercise_id"])] = ExerciseBestPerformance(
                date=row["workout_date"],
                weight=float(row["weight"]) if row["weight"] is not None else None,
                reps=int(row["reps"]) if row["reps"] is not None else None,
            )

        responses: List[ExerciseProgressResponse] = []
        for row in summary_rows:
            ex_id = int(row["exercise_id"])
            data_points = data_points_by_ex.get(ex_id, [])
            weights = [p.max_weight for p in data_points if p.max_weight is not None]

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
        return responses

    async def get_progress_insights(
        self,
        user_id: int,
        period: str,
        date_from: Optional[date],
        date_to: Optional[date],
        limit_best_sets: int,
        limit_pr_events: int,
    ) -> ProgressInsightsResponse:
        days = self._resolve_period_days(period)
        resolved_date_to = date_to or date.today()
        resolved_date_from = date_from or (resolved_date_to - timedelta(days=days))
        if resolved_date_from > resolved_date_to:
            raise AnalyticsValidationError("date_from cannot be greater than date_to")

        cache_key = self._build_cache_key(
            "progress-insights",
            user_id,
            period=period,
            date_from=resolved_date_from.isoformat(),
            date_to=resolved_date_to.isoformat(),
            limit_best_sets=limit_best_sets,
            limit_pr_events=limit_pr_events,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return ProgressInsightsResponse.model_validate(cached)

        summary_row = await self.repository.get_progress_insights_summary(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )
        volume_rows = await self.repository.get_progress_volume_trend(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )
        frequency_rows = await self.repository.get_progress_frequency_trend(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )
        best_set_rows = await self.repository.get_progress_best_sets(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            limit=limit_best_sets,
        )
        pr_rows = await self.repository.get_progress_pr_events(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            limit=limit_pr_events,
        )

        total_workouts = int(summary_row.get("total_workouts") or 0)
        weeks = max(1.0, ((resolved_date_to - resolved_date_from).days + 1) / 7)
        summary = ProgressInsightsSummary(
            total_workouts=total_workouts,
            active_days=int(summary_row.get("active_days") or 0),
            total_sets=int(summary_row.get("total_sets") or 0),
            total_reps=int(summary_row.get("total_reps") or 0),
            total_volume=round(float(summary_row.get("total_volume") or 0), 2),
            average_workouts_per_week=round(total_workouts / weeks, 2),
        )

        payload = ProgressInsightsResponse(
            period=period,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            summary=summary,
            volume_trend=[
                ProgressInsightsVolumePoint(
                    date=row["date"],
                    workout_count=int(row.get("workout_count") or 0),
                    total_sets=int(row.get("total_sets") or 0),
                    total_reps=int(row.get("total_reps") or 0),
                    total_volume=round(float(row.get("total_volume") or 0), 2),
                )
                for row in volume_rows
            ],
            frequency_trend=[
                ProgressInsightsFrequencyPoint(
                    week_start=row["week_start"],
                    week_end=row["week_end"],
                    active_days=int(row.get("active_days") or 0),
                    workout_count=int(row.get("workout_count") or 0),
                )
                for row in frequency_rows
            ],
            best_sets=[
                ProgressInsightsBestSetItem(
                    exercise_id=int(row["exercise_id"]),
                    exercise_name=row["exercise_name"],
                    date=row["date"],
                    set_number=int(row["set_number"]) if row.get("set_number") is not None else None,
                    weight=float(row["weight"]) if row.get("weight") is not None else None,
                    reps=int(row["reps"]) if row.get("reps") is not None else None,
                    volume=round(float(row.get("volume") or 0), 2),
                )
                for row in best_set_rows
            ],
            pr_events=[
                ProgressInsightsPRItem(
                    exercise_id=int(row["exercise_id"]),
                    exercise_name=row["exercise_name"],
                    date=row["date"],
                    weight=float(row["weight"]) if row.get("weight") is not None else None,
                    reps=int(row["reps"]) if row.get("reps") is not None else None,
                    previous_best_weight=(
                        float(row["previous_best_weight"])
                        if row.get("previous_best_weight") is not None
                        else None
                    ),
                    improvement=float(row["improvement"]) if row.get("improvement") is not None else None,
                    improvement_pct=(
                        round(float(row["improvement_pct"]), 2)
                        if row.get("improvement_pct") is not None
                        else None
                    ),
                    is_first_entry=bool(row.get("is_first_entry")),
                )
                for row in pr_rows
            ],
        )
        await set_cache_json(
            cache_key,
            payload.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return payload

    async def get_workout_post_summary(
        self,
        user_id: int,
        workout_id: int,
        limit_best_sets: int,
        limit_pr_events: int,
    ) -> WorkoutPostSummaryResponse:
        cache_key = self._build_cache_key(
            "workout-post-summary",
            user_id,
            workout_id=workout_id,
            limit_best_sets=limit_best_sets,
            limit_pr_events=limit_pr_events,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return WorkoutPostSummaryResponse.model_validate(cached)

        raw = await self.repository.get_workout_post_summary(
            user_id=user_id,
            workout_id=workout_id,
            limit_best_sets=limit_best_sets,
        )
        if not raw:
            raise AnalyticsNotFoundError("Workout summary not found")

        workout_data = raw.get("workout", {})
        totals = raw.get("totals", {})
        best_sets_rows = raw.get("best_sets", [])
        workout_exercises = workout_data.get("exercises") if isinstance(workout_data.get("exercises"), list) else []
        session_metrics = workout_data.get("session_metrics")
        if not session_metrics:
            session_metrics = compute_session_metrics(workout_exercises, int(workout_data.get("duration") or 0))
        insights = build_session_insights(session_metrics, int(workout_data.get("duration") or 0))
        pr_rows = await self.repository.get_progress_pr_events(
            user_id=user_id,
            date_from=workout_data["date"],
            date_to=workout_data["date"],
            limit=limit_pr_events,
        )

        response = WorkoutPostSummaryResponse(
            workout_id=int(workout_data["id"]),
            date=workout_data["date"],
            duration=int(workout_data.get("duration") or 0),
            total_sets=int(totals.get("total_sets") or 0),
            total_reps=int(totals.get("total_reps") or 0),
            total_volume=round(float(totals.get("total_volume") or 0), 2),
            session_metrics=session_metrics,
            insights=[WorkoutSessionInsightItem.model_validate(item) for item in insights],
            best_sets=[
                ProgressInsightsBestSetItem(
                    exercise_id=int(row["exercise_id"]),
                    exercise_name=row["exercise_name"],
                    date=row["date"],
                    set_number=int(row["set_number"]) if row.get("set_number") is not None else None,
                    weight=float(row["weight"]) if row.get("weight") is not None else None,
                    reps=int(row["reps"]) if row.get("reps") is not None else None,
                    volume=round(float(row.get("volume") or 0), 2),
                )
                for row in best_sets_rows
            ],
            pr_events=[
                ProgressInsightsPRItem(
                    exercise_id=int(row["exercise_id"]),
                    exercise_name=row["exercise_name"],
                    date=row["date"],
                    weight=float(row["weight"]) if row.get("weight") is not None else None,
                    reps=int(row["reps"]) if row.get("reps") is not None else None,
                    previous_best_weight=(
                        float(row["previous_best_weight"])
                        if row.get("previous_best_weight") is not None
                        else None
                    ),
                    improvement=float(row["improvement"]) if row.get("improvement") is not None else None,
                    improvement_pct=(
                        round(float(row["improvement_pct"]), 2)
                        if row.get("improvement_pct") is not None
                        else None
                    ),
                    is_first_entry=bool(row.get("is_first_entry")),
                )
                for row in pr_rows
            ],
        )
        await set_cache_json(
            cache_key,
            response.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return response

    async def get_performance_overview(
        self,
        user_id: int,
        period: str,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> AnalyticsPerformanceOverviewResponse:
        days = self._resolve_period_days(period)
        resolved_date_to = date_to or date.today()
        resolved_date_from = date_from or (resolved_date_to - timedelta(days=days))
        if resolved_date_from > resolved_date_to:
            raise AnalyticsValidationError("date_from cannot be greater than date_to")

        cache_key = self._build_cache_key(
            "performance-overview",
            user_id,
            period=period,
            date_from=resolved_date_from.isoformat(),
            date_to=resolved_date_to.isoformat(),
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return AnalyticsPerformanceOverviewResponse.model_validate(cached)

        summary_row = await self.repository.get_performance_overview_summary(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )
        trend_rows = await self.repository.get_performance_overview_trend(
            user_id=user_id,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )

        total_workouts = int(summary_row.get("total_workouts") or 0)
        active_days = int(summary_row.get("active_days") or 0)
        total_volume = round(float(summary_row.get("total_volume") or 0), 2)

        baseline_1rm = (
            round(float(summary_row["baseline_estimated_1rm"]), 2)
            if summary_row.get("baseline_estimated_1rm") is not None
            else None
        )
        current_1rm = (
            round(float(summary_row["current_estimated_1rm"]), 2)
            if summary_row.get("current_estimated_1rm") is not None
            else None
        )
        estimated_1rm_progress_pct = None
        if baseline_1rm is not None and current_1rm is not None and baseline_1rm > 0:
            estimated_1rm_progress_pct = round(((current_1rm - baseline_1rm) / baseline_1rm) * 100, 2)

        total_days = (resolved_date_to - resolved_date_from).days + 1
        weeks = max(1.0, total_days / 7)
        average_workouts_per_week = round(total_workouts / weeks, 2)
        average_volume_per_workout = round(total_volume / total_workouts, 2) if total_workouts > 0 else 0.0

        response = AnalyticsPerformanceOverviewResponse(
            period=period,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            total_workouts=total_workouts,
            active_days=active_days,
            average_workouts_per_week=average_workouts_per_week,
            total_volume=total_volume,
            average_volume_per_workout=average_volume_per_workout,
            baseline_estimated_1rm=baseline_1rm,
            current_estimated_1rm=current_1rm,
            estimated_1rm_progress_pct=estimated_1rm_progress_pct,
            trend=[
                AnalyticsPerformanceTrendPoint(
                    date=row["date"],
                    workout_count=int(row.get("workout_count") or 0),
                    total_volume=round(float(row.get("total_volume") or 0), 2),
                    best_estimated_1rm=(
                        round(float(row["best_estimated_1rm"]), 2)
                        if row.get("best_estimated_1rm") is not None
                        else None
                    ),
                )
                for row in trend_rows
            ],
        )

        await set_cache_json(
            cache_key,
            response.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return response

    async def get_workout_calendar(
        self,
        user_id: int,
        year: int,
        month: int,
    ) -> WorkoutCalendarResponse:
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
            return WorkoutCalendarResponse.model_validate(cached)

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
            summary=WorkoutCalendarSummary(
                total_workouts=total_workouts,
                total_duration=total_duration,
                active_days=active_days,
                rest_days=len(days) - active_days,
            ),
        )
        payload = response.model_dump(mode="json")
        await set_cache_json(cache_key, payload, ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS)
        return response

    async def export_data(
        self,
        user_id: int,
        export_request: DataExportRequest,
        idempotency_key: str | None = None,
    ) -> DataExportResponse:
        async def _once() -> DataExportResponse:
            _ = user_id
            export_id = f"exp_{uuid.uuid4().hex[:12]}"
            fmt = (
                export_request.format.value
                if hasattr(export_request.format, "value")
                else str(export_request.format)
            )
            return DataExportResponse(
                export_id=export_id,
                status=DataExportStatus.PENDING,
                format=fmt,
                download_url=None,
                expires_at=datetime.utcnow() + timedelta(days=1),
                requested_at=datetime.utcnow(),
                file_size=None,
            )

        if idempotency_key:
            return await run_idempotent(
                user_id=user_id,
                scope="analytics_export",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_DEFAULT_TTL_SECONDS,
                execute=_once,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: DataExportResponse.model_validate(d),
            )
        return await _once()

    async def get_export_status(self, user_id: int, export_id: str) -> DataExportResponse:
        _ = user_id
        raise AnalyticsNotFoundError("Export not found or expired")

    @staticmethod
    def _monday_of_week(day: date) -> date:
        return day - timedelta(days=day.weekday())

    @staticmethod
    def _current_streak_days(sorted_workout_dates: List[date]) -> int:
        if not sorted_workout_dates:
            return 0
        today = date.today()
        yesterday = today - timedelta(days=1)
        if sorted_workout_dates[-1] not in (today, yesterday):
            return 0
        current_streak = 0
        for i in range(len(sorted_workout_dates) - 1, -1, -1):
            if i == len(sorted_workout_dates) - 1:
                current_streak = 1
            elif (sorted_workout_dates[i + 1] - sorted_workout_dates[i]).days == 1:
                current_streak += 1
            else:
                break
        return current_streak

    @staticmethod
    def _build_dashboard_weekly_chart(
        period: str,
        daily_pairs: List[tuple[date, int]],
        chart_start: date,
        chart_end: date,
    ) -> List[AnalyticsWeeklyChartPoint]:
        day_map = {d: c for d, c in daily_pairs}
        if period == "week":
            out: List[AnalyticsWeeklyChartPoint] = []
            d = chart_start
            while d <= chart_end:
                out.append(AnalyticsWeeklyChartPoint(date=d, count=day_map.get(d, 0)))
                d += timedelta(days=1)
            return out

        weekly: dict[date, int] = defaultdict(int)
        for d, c in daily_pairs:
            if chart_start <= d <= chart_end:
                weekly[AnalyticsService._monday_of_week(d)] += c
        return [
            AnalyticsWeeklyChartPoint(date=w, count=weekly[w])
            for w in sorted(weekly.keys())
        ]

    async def get_analytics_dashboard(self, user_id: int, period: str) -> AnalyticsDashboardResponse:
        today = date.today()
        if period == "week":
            window_start = today - timedelta(days=6)
        elif period == "month":
            window_start = today - timedelta(days=29)
        else:
            earliest = await self.repository.get_earliest_workout_date(user_id)
            window_start = earliest or today

        window_end = today

        total_workouts = await self.repository.count_workouts_between(
            user_id, window_start, window_end
        )
        total_duration = await self.repository.sum_duration_minutes_between(
            user_id, window_start, window_end
        )
        avg_duration = round(total_duration / total_workouts, 1) if total_workouts else 0.0

        favorite_raw = await self.repository.get_favorite_exercises(
            user_id=user_id,
            date_from=window_start,
            limit=1,
            date_to=window_end,
        )
        favorite_exercise = favorite_raw[0]["name"] if favorite_raw else None

        week_monday = self._monday_of_week(today)
        workouts_this_week = await self.repository.count_workouts_between(
            user_id, week_monday, today
        )

        month_first = today.replace(day=1)
        _, last_dom = calendar.monthrange(today.year, today.month)
        month_last = today.replace(day=last_dom)
        workouts_this_month = await self.repository.count_workouts_between(
            user_id, month_first, min(month_last, today)
        )

        all_dates = await self.repository.get_workout_dates(
            user_id=user_id,
            date_from=date(1970, 1, 1),
            date_to=today,
        )
        streak_days = self._current_streak_days(all_dates)

        if period == "all":
            chart_end = today
            chart_start = today - timedelta(days=83)
        else:
            chart_start, chart_end = window_start, window_end

        daily_pairs = await self.repository.get_workout_counts_by_day(
            user_id, chart_start, chart_end
        )
        weekly_chart = self._build_dashboard_weekly_chart(
            period, daily_pairs, chart_start, chart_end
        )

        intensity_rows = await self.repository.list_workout_logs_exercises_for_intensity(
            user_id=user_id,
            date_from=window_start,
            date_to=window_end,
        )
        intensity_metrics = compute_intensity_metrics_from_logs(intensity_rows)

        n_days = (window_end - window_start).days + 1
        prev_end = window_start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=n_days - 1)
        prev_intensity: dict[str, Any] = {}
        if prev_start <= prev_end:
            prev_rows = await self.repository.list_workout_logs_exercises_for_intensity(
                user_id=user_id,
                date_from=prev_start,
                date_to=prev_end,
            )
            prev_intensity = compute_intensity_metrics_from_logs(prev_rows)

        cur_rpe = intensity_metrics.get("avg_rpe_per_workout")
        prev_rpe = prev_intensity.get("avg_rpe_per_workout")
        avg_rpe_trend: Optional[str] = None
        if isinstance(cur_rpe, (int, float)) and isinstance(prev_rpe, (int, float)):
            delta = float(cur_rpe) - float(prev_rpe)
            if delta > 0.05:
                avg_rpe_trend = "up"
            elif delta < -0.05:
                avg_rpe_trend = "down"
            else:
                avg_rpe_trend = "flat"

        chart_intensity_rows = [r for r in intensity_rows if chart_start <= r[1] <= chart_end]
        intensity_weekly_chart = compute_intensity_weekly_chart(
            chart_intensity_rows, chart_start, chart_end
        )

        return AnalyticsDashboardResponse(
            period=period,
            total_workouts=total_workouts,
            total_duration_minutes=total_duration,
            avg_duration=avg_duration,
            workouts_this_week=workouts_this_week,
            workouts_this_month=workouts_this_month,
            favorite_exercise=favorite_exercise,
            streak_days=streak_days,
            weekly_chart=weekly_chart,
            avg_rpe_per_workout=intensity_metrics.get("avg_rpe_per_workout"),
            avg_rpe_previous_period=prev_intensity.get("avg_rpe_per_workout"),
            avg_rpe_trend=avg_rpe_trend,
            avg_rest_time_seconds=intensity_metrics.get("avg_rest_time_seconds"),
            total_time_under_tension_seconds=intensity_metrics.get("total_time_under_tension_seconds"),
            intensity_score=intensity_metrics.get("intensity_score"),
            intensity_weekly_chart=intensity_weekly_chart,
            workouts_with_rpe_count=int(intensity_metrics.get("workouts_with_rpe_count") or 0),
        )

    async def get_analytics_summary(self, user_id: int, period: str) -> AnalyticsSummaryResponse:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 36500}
        days = days_map.get(period, 30)
        date_from = date.today() - timedelta(days=days)

        muscle_signals_enabled = await FeatureFlagsRepository(self.repository.db).is_enabled(
            "muscle_imbalance_signals", default=False
        )
        cache_key = self._build_cache_key(
            "summary",
            user_id,
            period=period,
            muscle_signals=muscle_signals_enabled,
        )
        cached = await get_cache_json(cache_key)
        if cached is not None:
            return AnalyticsSummaryResponse.model_validate(cached)

        summary_row = await self.repository.get_summary_totals(user_id=user_id, date_from=date_from)
        total_workouts = int(summary_row.total_workouts or 0)

        if total_workouts == 0:
            empty = AnalyticsSummaryResponse(
                total_workouts=0,
                total_duration=0,
                total_exercises=0,
                current_streak=0,
                longest_streak=0,
                personal_records=[],
                favorite_exercises=[],
                weekly_average=0.0,
                monthly_average=0.0,
                muscle_imbalance_signals=None,
            )
            await set_cache_json(
                cache_key,
                empty.model_dump(mode="json"),
                ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
            )
            return empty

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

        favorite_raw = await self.repository.get_favorite_exercises(
            user_id=user_id,
            date_from=date_from,
            limit=5,
        )
        favorite_exercises = [FavoriteExercise.model_validate(x) for x in favorite_raw]

        weeks = max(1, days / 7)
        months = max(1, days / 30)

        muscle_imbalance_signals: MuscleImbalanceSignalsDetail | None = None
        if muscle_signals_enabled:
            try:
                raw_signals = await self.repository.get_muscle_imbalance_signals(user_id)
                if raw_signals:
                    muscle_imbalance_signals = MuscleImbalanceSignalsDetail.model_validate(raw_signals)
            except SQLAlchemyError:
                muscle_imbalance_signals = None

        summary = AnalyticsSummaryResponse(
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
        )
        await set_cache_json(
            cache_key,
            summary.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return summary

    async def get_muscle_imbalance_signals(self, user_id: int) -> MuscleImbalanceSignalsResponse:
        muscle_signals_enabled = await FeatureFlagsRepository(self.repository.db).is_enabled(
            "muscle_imbalance_signals", default=False
        )
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

        detail = MuscleImbalanceSignalsDetail.model_validate(signals) if signals else None
        dto = MuscleImbalanceSignalsResponse(available=bool(signals), signals=detail)
        await set_cache_json(
            cache_key,
            dto.model_dump(mode="json"),
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
        )
        return dto
