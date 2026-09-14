"""Centralized strength math for SPEC-005.

Single source of truth for:
- estimated 1RM (Epley formula, capped by reps count) — §41
- plate calculator with symmetric loading — §42–43

Both frontend and analytics must use the same formulas; backend exposes them
via the API and reproduces them here for verification and progression math.
"""
from __future__ import annotations

from typing import Optional

# Above this rep count an e1RM estimate is considered unreliable (SPEC-005 §41).
E1RM_MAX_REPS = 15


def round_to_increment(value: float, increment: float) -> float:
    """Round ``value`` down to the nearest multiple of ``increment``."""
    if increment <= 0:
        return round(value, 2)
    return round(round(value / increment) * increment, 2)


def estimate_1rm(weight: float, reps: int) -> Optional[float]:
    """Epley e1RM; returns None outside the usable rep range (1..E1RM_MAX_REPS)."""
    if weight <= 0 or reps <= 0 or reps > E1RM_MAX_REPS:
        return None
    return round(weight * (1 + reps / 30.0), 2)


DEFAULT_AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]


def calculate_plates(
    target_weight: float,
    bar_weight: float = 20,
    available_plates: list[float] | None = None,
) -> dict:
    """Compute symmetric plate loading per side for a barbell target.

    Returns:
        dict with:
        - achievable: exact target can be assembled
        - plates_per_side: descending plate list for ONE side
        - exact_weight: assembled weight when achievable
        - nearest_weight: closest achievable weight below the target (§43)
        - remainder: unresolvable leftover weight
    """
    plates_source = available_plates if available_plates is not None else DEFAULT_AVAILABLE_PLATES
    side_target = (target_weight - bar_weight) / 2.0
    if side_target < 0:
        return {
            "achievable": False,
            "plates_per_side": [],
            "exact_weight": None,
            "nearest_weight": bar_weight,
            "remainder": round(target_weight - bar_weight, 2),
        }

    plates = sorted((p for p in plates_source if p > 0), reverse=True)
    per_side: list[float] = []
    remaining = round(side_target, 2)

    for plate in plates:
        while remaining >= plate - 1e-9:
            per_side.append(plate)
            remaining = round(remaining - plate, 2)

    achievable = abs(remaining) < 1e-6
    exact_weight = round(bar_weight + 2 * sum(per_side), 2) if per_side or achievable else None

    nearest_weight = round(bar_weight + 2 * sum(per_side), 2) if not achievable else round(target_weight, 2)

    return {
        "achievable": achievable,
        "plates_per_side": per_side,
        "exact_weight": exact_weight,
        "nearest_weight": nearest_weight,
        "remainder": round(remaining, 2),
    }
