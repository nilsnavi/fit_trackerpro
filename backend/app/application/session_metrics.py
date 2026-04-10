from __future__ import annotations

from typing import Any, Optional


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _round_or_none(value: Optional[float], digits: int = 2) -> Optional[float]:
    if value is None:
        return None
    return round(value, digits)


def compute_session_metrics(exercises: Optional[list[dict[str, Any]]], duration_minutes: Optional[int]) -> dict[str, Any]:
    if not exercises:
        return {
            "completed_sets": 0,
            "avg_rpe": None,
            "avg_rir": None,
            "total_rest_seconds": 0,
            "avg_rest_seconds": None,
            "rest_tracked_sets": 0,
            "rest_tracking_ratio": 0.0,
            "rest_consistency_score": None,
            "fatigue_trend": None,
            "effort_distribution": {
                "easy": 0,
                "moderate": 0,
                "hard": 0,
                "maximal": 0,
            },
            "volume_per_minute": None,
        }

    total_volume = 0.0
    completed_sets = 0
    rest_candidates = 0
    rest_values: list[float] = []
    rpe_values: list[float] = []
    rir_values: list[float] = []
    ordered_rpe_values: list[float] = []
    effort_distribution = {
        "easy": 0,
        "moderate": 0,
        "hard": 0,
        "maximal": 0,
    }

    for exercise in exercises:
        if not isinstance(exercise, dict):
            continue
        raw_sets = exercise.get("sets_completed")
        if not isinstance(raw_sets, list):
            continue

        completed_in_exercise = 0
        for set_item in raw_sets:
            if not isinstance(set_item, dict) or not bool(set_item.get("completed", False)):
                continue

            completed_sets += 1
            completed_in_exercise += 1

            reps = _safe_float(set_item.get("reps"))
            weight = _safe_float(set_item.get("weight"))
            if reps is not None and weight is not None and reps >= 0 and weight >= 0:
                total_volume += reps * weight

            rpe = _safe_float(set_item.get("rpe"))
            if rpe is not None and 0 <= rpe <= 10:
                rpe_values.append(rpe)
                ordered_rpe_values.append(rpe)
                if rpe <= 6.5:
                    effort_distribution["easy"] += 1
                elif rpe <= 7.5:
                    effort_distribution["moderate"] += 1
                elif rpe < 9:
                    effort_distribution["hard"] += 1
                else:
                    effort_distribution["maximal"] += 1

            rir = _safe_float(set_item.get("rir"))
            if rir is not None and 0 <= rir <= 10:
                rir_values.append(rir)

            actual_rest = _safe_float(set_item.get("actual_rest_seconds"))
            if actual_rest is not None and actual_rest >= 0:
                rest_values.append(actual_rest)

        if completed_in_exercise > 1:
            rest_candidates += completed_in_exercise - 1

    avg_rpe = sum(rpe_values) / len(rpe_values) if rpe_values else None
    avg_rir = sum(rir_values) / len(rir_values) if rir_values else None
    avg_rest_seconds = sum(rest_values) / len(rest_values) if rest_values else None
    total_rest_seconds = int(round(sum(rest_values))) if rest_values else 0
    rest_tracking_ratio = min(1.0, len(rest_values) / rest_candidates) if rest_candidates > 0 else 0.0

    rest_consistency_score = None
    if len(rest_values) >= 2 and avg_rest_seconds and avg_rest_seconds > 0:
        variance = sum((value - avg_rest_seconds) ** 2 for value in rest_values) / len(rest_values)
        coeff_var = (variance ** 0.5) / avg_rest_seconds
        rest_consistency_score = max(0.0, min(100.0, 100.0 - coeff_var * 100.0))

    fatigue_trend = None
    if len(ordered_rpe_values) >= 2:
        midpoint = max(1, len(ordered_rpe_values) // 2)
        opening = ordered_rpe_values[:midpoint]
        closing = ordered_rpe_values[midpoint:]
        if closing:
            opening_avg = sum(opening) / len(opening)
            closing_avg = sum(closing) / len(closing)
            fatigue_trend = {
                "opening_avg_rpe": round(opening_avg, 2),
                "closing_avg_rpe": round(closing_avg, 2),
                "delta": round(closing_avg - opening_avg, 2),
            }

    volume_per_minute = None
    if duration_minutes is not None and duration_minutes > 0:
        volume_per_minute = total_volume / duration_minutes

    return {
        "completed_sets": completed_sets,
        "avg_rpe": _round_or_none(avg_rpe, 2),
        "avg_rir": _round_or_none(avg_rir, 2),
        "total_rest_seconds": total_rest_seconds,
        "avg_rest_seconds": _round_or_none(avg_rest_seconds, 1),
        "rest_tracked_sets": len(rest_values),
        "rest_tracking_ratio": round(rest_tracking_ratio, 2),
        "rest_consistency_score": _round_or_none(rest_consistency_score, 1),
        "fatigue_trend": fatigue_trend,
        "effort_distribution": effort_distribution,
        "volume_per_minute": _round_or_none(volume_per_minute, 2),
    }


def build_session_insights(metrics: Optional[dict[str, Any]], duration_minutes: Optional[int]) -> list[dict[str, str]]:
    if not metrics:
        return []

    insights: list[dict[str, str]] = []
    rest_tracking_ratio = _safe_float(metrics.get("rest_tracking_ratio")) or 0.0
    rest_consistency_score = _safe_float(metrics.get("rest_consistency_score"))
    avg_rest_seconds = _safe_float(metrics.get("avg_rest_seconds"))
    avg_rpe = _safe_float(metrics.get("avg_rpe"))
    volume_per_minute = _safe_float(metrics.get("volume_per_minute"))
    effort_distribution = metrics.get("effort_distribution") if isinstance(metrics.get("effort_distribution"), dict) else {}
    fatigue_trend = metrics.get("fatigue_trend") if isinstance(metrics.get("fatigue_trend"), dict) else None

    if rest_tracking_ratio >= 0.5 and avg_rest_seconds is not None:
        if rest_consistency_score is not None and rest_consistency_score >= 80:
            insights.append({
                "code": "rest_consistency",
                "title": "Ровный отдых",
                "level": "positive",
                "message": f"Паузы между подходами были стабильными. Средний отдых {round(avg_rest_seconds)} сек.",
            })
        elif rest_consistency_score is not None and rest_consistency_score < 55:
            insights.append({
                "code": "rest_consistency",
                "title": "Паузы прыгали",
                "level": "neutral",
                "message": "Отдых между подходами заметно менялся. Для более предсказуемой силовой работы держите паузы ровнее.",
            })
    elif rest_tracking_ratio > 0:
        insights.append({
            "code": "rest_tracking_coverage",
            "title": "Отдых отслежен частично",
            "level": "info",
            "message": "Часть пауз зафиксирована. Чтобы rest insights были точнее, чаще используйте таймер отдыха.",
        })

    if fatigue_trend:
        delta = _safe_float(fatigue_trend.get("delta")) or 0.0
        if delta >= 1.0:
            insights.append({
                "code": "fatigue_trend",
                "title": "Усталость росла к концу",
                "level": "neutral",
                "message": "Финальные подходы ощущались заметно тяжелее стартовых. В похожей сессии можно раньше увеличить паузы или чуть снизить объём.",
            })
        elif delta <= -1.0:
            insights.append({
                "code": "fatigue_trend",
                "title": "Финиш легче старта",
                "level": "positive",
                "message": "К концу тренировки субъективная тяжесть снизилась. Есть запас для аккуратной прогрессии веса или плотности.",
            })

    maximal_sets = int(effort_distribution.get("maximal") or 0)
    hard_sets = int(effort_distribution.get("hard") or 0)
    completed_sets = int(metrics.get("completed_sets") or 0)
    hard_ratio = ((maximal_sets + hard_sets) / completed_sets) if completed_sets > 0 else 0.0
    if completed_sets > 0:
        if maximal_sets > 0 and hard_ratio >= 0.35:
            insights.append({
                "code": "effort_distribution",
                "title": "Много тяжёлых подходов",
                "level": "warning",
                "message": "Заметная часть сетов была близка к пределу. На следующую сессию лучше не добавлять слишком много тяжёлого объёма подряд.",
            })
        elif avg_rpe is not None and avg_rpe < 7:
            insights.append({
                "code": "effort_distribution",
                "title": "Умеренная интенсивность",
                "level": "positive",
                "message": "Сессия прошла без чрезмерной субъективной нагрузки. Это хороший профиль для накопления объёма и стабильной частоты.",
            })

    if duration_minutes and duration_minutes > 0 and avg_rpe is not None and volume_per_minute is not None:
        if volume_per_minute >= 120 and avg_rpe >= 8.0:
            insights.append({
                "code": "recovery_hint",
                "title": "Высокая плотность нагрузки",
                "level": "warning",
                "message": "Объём на минуту и усилие были высокими. Практичный recovery шаг: следующую тренировку держать чуть мягче по плотности или паузам.",
            })
        elif volume_per_minute < 60 and avg_rpe < 7.5:
            insights.append({
                "code": "recovery_hint",
                "title": "Обычная нагрузка на восстановление",
                "level": "positive",
                "message": "По плотности и усилию эта сессия не выглядит перегружающей. Следующий рабочий день можно планировать без особой разгрузки.",
            })

    return insights[:4]