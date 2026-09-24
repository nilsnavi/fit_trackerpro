"""Equipment-aware rounding for SPEC-006 §21–§22.

Two distinct operations live here and they are *not* interchangeable:

* :func:`advance_weight` — used for INCREASE. The delta is quantized to the
  equipment step, but the *offset* of the current weight is preserved
  (``81 + 2.5 -> 83.5``, never snapped down to ``82.5``). SPEC §22.
* :func:`snap_to_equipment` — used for absolute targets (percentage of 1RM,
  deload). Those are computed from scratch, so snapping to the equipment grid
  is correct. SPEC §20/§26.
"""
from __future__ import annotations

from typing import Iterable, Optional

from app.application.strength_math import round_to_increment

# Default minimum step per equipment code, used when a policy does not carry an
# explicit step. Codes come from ``ref_equipment`` (backend/reference_data).
DEFAULT_EQUIPMENT_INCREMENTS: dict[str, float] = {
    "barbell": 2.5,
    "dumbbells": 2.0,
    "kettlebell": 4.0,
    "smith_machine": 2.5,
    "cable_machine": 2.5,
    "leg_press": 5.0,
    "medicine_ball": 1.0,
    "resistance_bands": 1.0,
    # Bodyweight / free-form equipment: keep the smallest sane barbell step.
    "none": 2.5,
    "bench": 2.5,
    "pull_up_bar": 2.5,
}

FALLBACK_EQUIPMENT_INCREMENT = 2.5
# Guards against float noise when quantizing deltas (2.5 stays 2.5).
_ROUNDING_PRECISION = 2


def resolve_increment_step(
    *,
    equipment_codes: Optional[Iterable[str]] = None,
    explicit_step: Optional[float] = None,
    policy_increment: Optional[float] = None,
) -> float:
    """Pick the smallest usable step for an exercise.

    Priority: explicit policy step -> finest known equipment step -> the policy
    increment itself -> global fallback. Never hardcodes a single global value,
    and never returns a step larger than the policy increment.
    """
    if explicit_step is not None and explicit_step > 0:
        return float(explicit_step)

    candidates = [
        DEFAULT_EQUIPMENT_INCREMENTS[code]
        for code in (equipment_codes or ())
        if code in DEFAULT_EQUIPMENT_INCREMENTS
    ]
    step = min(candidates) if candidates else FALLBACK_EQUIPMENT_INCREMENT
    if policy_increment is not None and policy_increment > 0:
        step = min(step, float(policy_increment))
    return float(step)


def quantize_delta(delta: float, step: float) -> float:
    """Largest multiple of ``step`` that does not exceed ``delta`` (min one step)."""
    if step <= 0:
        return round(delta, _ROUNDING_PRECISION)
    if delta <= step:
        return round(step, _ROUNDING_PRECISION)
    steps = int((delta + 1e-9) // step)
    return round(max(steps, 1) * step, _ROUNDING_PRECISION)


def advance_weight(current: float, increment: float, step: float) -> float:
    """SPEC §22 — increase the *current* weight, preserving its offset."""
    if current is None:
        return current
    return round(float(current) + quantize_delta(float(increment), float(step)), _ROUNDING_PRECISION)


def snap_to_equipment(value: float, step: float) -> float:
    """Snap an absolute target (e1RM %, deload) to the equipment grid."""
    if value is None:
        return value
    if step <= 0:
        return round(float(value), _ROUNDING_PRECISION)
    return round_to_increment(float(value), float(step))
