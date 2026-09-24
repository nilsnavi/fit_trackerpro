"""Pure domain types for SPEC-006 Progression Engine.

Nothing in this module touches SQL, HTTP, UI state or Telegram. The engine
receives already-prepared data and returns an immutable evaluation. All reason
codes are enum members (never free-form strings) so recommendations stay
explainable and machine-translatable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from typing import Any, Optional, Sequence

from app.schemas.enums import ProgressionPolicy

# ─── Defaults (overridable per policy row) ───────────────────────────────────
DEFAULT_INCREMENT = 2.5
DEFAULT_REP_RANGE: tuple[int, int] = (8, 12)
DEFAULT_SETS_TARGET = 3
DEFAULT_FAILURE_THRESHOLD = 3
DEFAULT_DELOAD_PERCENT = 10.0
DEFAULT_TIME_INCREMENT_SECONDS = 5
DEFAULT_INCREMENT_STEP = 2.5
# SPEC-006 §19: e1RM is only meaningful in a bounded rep window (default 1–12).
DEFAULT_E1RM_MAX_REPS = 12


class RecommendationStatus(StrEnum):
    """SPEC-006 §9."""

    INCREASE = "INCREASE"
    KEEP = "KEEP"
    DECREASE = "DECREASE"
    DELOAD = "DELOAD"
    MANUAL = "MANUAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class RecommendationLifecycle(StrEnum):
    """SPEC-006 §10 — a recommendation never mutates the program by itself."""

    GENERATED = "generated"
    ACCEPTED = "accepted"
    MODIFIED = "modified"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ReasonCode(StrEnum):
    """SPEC-006 §28 (extended with two explicit set-completeness codes)."""

    TARGET_COMPLETED = "TARGET_COMPLETED"
    REP_RANGE_COMPLETED = "REP_RANGE_COMPLETED"
    TARGET_NOT_COMPLETED = "TARGET_NOT_COMPLETED"
    TARGET_SETS_INCOMPLETE = "TARGET_SETS_INCOMPLETE"
    TARGET_RPE_MET = "TARGET_RPE_MET"
    TARGET_RPE_EXCEEDED = "TARGET_RPE_EXCEEDED"
    TARGET_RIR_MET = "TARGET_RIR_MET"
    TARGET_RIR_EXCEEDED = "TARGET_RIR_EXCEEDED"
    FAILURE_THRESHOLD_REACHED = "FAILURE_THRESHOLD_REACHED"
    TIME_TARGET_COMPLETED = "TIME_TARGET_COMPLETED"
    TARGET_NOT_COMPLETED_TIME = "TARGET_NOT_COMPLETED_TIME"
    NO_PREVIOUS_HISTORY = "NO_PREVIOUS_HISTORY"
    INSUFFICIENT_RPE_DATA = "INSUFFICIENT_RPE_DATA"
    INSUFFICIENT_RIR_DATA = "INSUFFICIENT_RIR_DATA"
    MANUAL_POLICY = "MANUAL_POLICY"
    POLICY_DISABLED = "POLICY_DISABLED"


class PolicyVersion(StrEnum):
    """SPEC-006 §36 — engine algorithm revision, pinned per recommendation."""

    MANUAL_V1 = "MANUAL_V1"
    LINEAR_V1 = "LINEAR_V1"
    DOUBLE_PROGRESSION_V1 = "DOUBLE_PROGRESSION_V1"
    RPE_BASED_V1 = "RPE_BASED_V1"
    RIR_BASED_V1 = "RIR_BASED_V1"
    PERCENT_1RM_V1 = "PERCENT_1RM_V1"
    TIME_PROGRESSION_V1 = "TIME_PROGRESSION_V1"

    @classmethod
    def for_policy(cls, policy: ProgressionPolicy) -> "PolicyVersion":
        return _POLICY_VERSIONS[policy]


_POLICY_VERSIONS: dict[ProgressionPolicy, PolicyVersion] = {
    ProgressionPolicy.MANUAL: PolicyVersion.MANUAL_V1,
    ProgressionPolicy.LINEAR: PolicyVersion.LINEAR_V1,
    ProgressionPolicy.DOUBLE_PROGRESSION: PolicyVersion.DOUBLE_PROGRESSION_V1,
    ProgressionPolicy.RPE_BASED: PolicyVersion.RPE_BASED_V1,
    ProgressionPolicy.RIR_BASED: PolicyVersion.RIR_BASED_V1,
    ProgressionPolicy.PERCENT_1RM: PolicyVersion.PERCENT_1RM_V1,
    ProgressionPolicy.TIME_PROGRESSION: PolicyVersion.TIME_PROGRESSION_V1,
}


class Confidence(StrEnum):
    """SPEC-006 §29 — quality of the underlying data, not an AI probability."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TimePriority(StrEnum):
    """SPEC-006 §24 — weight+time exercises: which lever moves first."""

    TIME_FIRST = "TIME_FIRST"
    WEIGHT_FIRST = "WEIGHT_FIRST"


# Set types that never drive target evaluation (SPEC-006 §15).
NON_TARGET_SET_TYPES = frozenset({"warmup", "dropset", "failure"})
TARGET_SET_TYPE = "working"


@dataclass(frozen=True, slots=True)
class SetRecord:
    """One performed set, normalized from the workout payload."""

    set_type: str = TARGET_SET_TYPE
    reps: Optional[int] = None
    weight: Optional[float] = None
    rpe: Optional[float] = None
    rir: Optional[float] = None
    duration: Optional[int] = None
    completed: bool = True

    @property
    def is_target(self) -> bool:
        """Warm-up / dropset / failure never count as a working target set."""
        return self.completed and self.set_type == TARGET_SET_TYPE


@dataclass(frozen=True, slots=True)
class ExerciseSessionRecord:
    """Per-exercise slice of one workout session."""

    session_id: Optional[int] = None
    session_date: Optional[date] = None
    status: str = "completed"
    skipped: bool = False
    sets: tuple[SetRecord, ...] = ()
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None

    @property
    def is_relevant(self) -> bool:
        """SPEC-006 §31/§32: cancelled sessions and skipped exercises are excluded."""
        return self.status == "completed" and not self.skipped

    @property
    def target_sets(self) -> tuple[SetRecord, ...]:
        return tuple(s for s in self.sets if s.is_target)

    def has_data(self) -> bool:
        """True when the session carries at least one usable working set."""
        return any(
            s.reps is not None or s.duration is not None or s.weight is not None
            for s in self.target_sets
        )


@dataclass(frozen=True, slots=True)
class ProgressionScope:
    """SPEC-006 §7 — progression is bound to user + template + exercise + slot.

    The same exercise in two different program slots therefore keeps two
    independent progression sequences.
    """

    user_id: int
    exercise_id: int
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None

    @property
    def key(self) -> str:
        """Deterministic string key persisted next to every policy/recommendation."""
        parts = [f"u{self.user_id}"]
        if self.template_id is not None:
            parts.append(f"t{self.template_id}")
        if self.template_exercise_id is not None:
            parts.append(f"te{self.template_exercise_id}")
        parts.append(f"e{self.exercise_id}")
        return ":".join(parts)


@dataclass(frozen=True, slots=True)
class ExerciseProgressionSettings:
    """Resolved policy settings handed to the engine."""

    policy: ProgressionPolicy = ProgressionPolicy.MANUAL
    policy_version: Optional[str] = None
    enabled: bool = True
    increment: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    sets_target: Optional[int] = None
    target_rpe: Optional[float] = None
    target_rir: Optional[float] = None
    percent_1rm: Optional[float] = None
    time_increment_seconds: Optional[int] = None
    time_target_seconds: Optional[int] = None
    time_priority: Optional[TimePriority] = None
    failure_threshold: Optional[int] = None
    deload_percent: Optional[float] = None
    increment_step: Optional[float] = None
    e1rm_max_reps: int = DEFAULT_E1RM_MAX_REPS
    extra: dict[str, Any] = field(default_factory=dict)

    # ─── resolved accessors (defaults applied once, deterministically) ───────
    @property
    def resolved_increment(self) -> float:
        if self.increment is not None and self.increment > 0:
            return float(self.increment)
        return DEFAULT_INCREMENT

    @property
    def resolved_reps_min(self) -> int:
        return int(self.reps_min) if self.reps_min is not None else DEFAULT_REP_RANGE[0]

    @property
    def resolved_reps_max(self) -> int:
        value = int(self.reps_max) if self.reps_max is not None else DEFAULT_REP_RANGE[1]
        return max(value, self.resolved_reps_min)

    @property
    def explicit_sets_target(self) -> Optional[int]:
        """Configured target set count, or ``None`` when the scope leaves it free.

        Only an explicitly configured target turns "fewer sets than planned"
        into an incomplete session (SPEC §14); otherwise the working sets that
        were actually performed are evaluated and confidence is capped at
        ``medium``.
        """
        if self.sets_target is not None and self.sets_target > 0:
            return int(self.sets_target)
        return None

    @property
    def resolved_sets_target(self) -> int:
        """Target set count used for planning/confidence display."""
        return self.explicit_sets_target or DEFAULT_SETS_TARGET

    @property
    def resolved_target_rpe(self) -> float:
        return float(self.target_rpe) if self.target_rpe is not None else 8.0

    @property
    def resolved_target_rir(self) -> float:
        return float(self.target_rir) if self.target_rir is not None else 2.0

    @property
    def resolved_percent_1rm(self) -> Optional[float]:
        """SPEC-006 §20 — percentage is required; 75% is the default target."""
        if self.percent_1rm is not None and self.percent_1rm > 0:
            return float(self.percent_1rm)
        return 75.0

    @property
    def resolved_time_increment(self) -> int:
        if self.time_increment_seconds is not None and self.time_increment_seconds > 0:
            return int(self.time_increment_seconds)
        return DEFAULT_TIME_INCREMENT_SECONDS

    @property
    def resolved_failure_threshold(self) -> int:
        if self.failure_threshold is not None and self.failure_threshold > 0:
            return int(self.failure_threshold)
        return DEFAULT_FAILURE_THRESHOLD

    @property
    def resolved_deload_percent(self) -> float:
        if self.deload_percent is not None and self.deload_percent > 0:
            return float(self.deload_percent)
        return DEFAULT_DELOAD_PERCENT

    @property
    def resolved_increment_step(self) -> float:
        """Minimum equipment step; falls back to the barbell 2.5 kg default."""
        if self.increment_step is not None and self.increment_step > 0:
            return float(self.increment_step)
        return DEFAULT_INCREMENT_STEP

    @property
    def effective_policy_version(self) -> str:
        return str(self.policy_version or PolicyVersion.for_policy(self.policy))


@dataclass(frozen=True, slots=True)
class ProgressionEvaluation:
    """Engine output (SPEC-006 §8) — explainable, deterministic, side-effect free."""

    policy: ProgressionPolicy
    policy_version: str
    status: RecommendationStatus
    reason_code: str
    reason_text: str
    confidence: str = Confidence.LOW.value
    previous_value: Optional[float] = None
    recommended_value: Optional[float] = None
    difference: Optional[float] = None
    previous_reps: Optional[int] = None
    recommended_reps: Optional[int] = None
    previous_duration: Optional[int] = None
    recommended_duration: Optional[int] = None
    source_session_id: Optional[int] = None
    failure_streak: int = 0
    warnings: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        """Wire/persistence shape shared by API and repository layers."""
        return {
            "policy": self.policy.value,
            "policy_version": self.policy_version,
            "status": self.status.value,
            "reason_code": self.reason_code,
            "reason_text": self.reason_text,
            "confidence": self.confidence,
            "previous_value": self.previous_value,
            "recommended_value": self.recommended_value,
            "difference": self.difference,
            "previous_reps": self.previous_reps,
            "recommended_reps": self.recommended_reps,
            "previous_duration": self.previous_duration,
            "recommended_duration": self.recommended_duration,
            "source_session_id": self.source_session_id,
        }

    def as_preview(self) -> dict[str, Any]:
        """Backward-compatible shape of the SPEC-005 preview endpoint."""
        return {
            "recommended_value": self.recommended_value,
            "previous_value": self.previous_value,
            "difference": self.difference,
            "policy": self.policy.value,
            "reason_code": self.reason_code,
            "reason_text": self.reason_text,
            "confidence": self.confidence,
            "source_session_id": self.source_session_id,
        }


def _field(raw: Any, key: str, default: Any = None) -> Any:
    """Read a field from either a dict payload or an ORM object."""
    if isinstance(raw, dict):
        return raw.get(key, default)
    return getattr(raw, key, default)


def normalize_sets(raw_sets: Optional[Sequence[Any]]) -> tuple[SetRecord, ...]:
    """Build ``SetRecord`` tuples from dict/ORM-like payloads (defensive parsing)."""
    records: list[SetRecord] = []
    for raw in raw_sets or ():
        if isinstance(raw, SetRecord):
            records.append(raw)
            continue
        records.append(
            SetRecord(
                set_type=str(_field(raw, "set_type") or TARGET_SET_TYPE),
                reps=_as_int(_field(raw, "reps")),
                weight=_as_float(_field(raw, "weight")),
                rpe=_as_float(_field(raw, "rpe")),
                rir=_as_float(_field(raw, "rir")),
                duration=_as_int(_field(raw, "duration")),
                completed=bool(_field(raw, "completed", True)),
            )
        )
    return tuple(records)


def _as_float(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value: Any) -> Optional[int]:
    try:
        return None if value is None else int(value)
    except (TypeError, ValueError):
        return None
