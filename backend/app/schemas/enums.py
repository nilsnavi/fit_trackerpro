"""Shared string enums for API request validation (OpenAPI + consistent 422 errors)."""

from __future__ import annotations

from enum import StrEnum


class ExerciseCategory(StrEnum):
    STRENGTH = "strength"
    CARDIO = "cardio"
    FLEXIBILITY = "flexibility"
    BALANCE = "balance"
    SPORT = "sport"
    REHAB = "rehab"


class ExerciseStatus(StrEnum):
    ACTIVE = "active"
    PENDING = "pending"
    ARCHIVED = "archived"


class ExerciseListStatusFilter(StrEnum):
    """Includes ``all`` for list endpoints."""

    ACTIVE = "active"
    PENDING = "pending"
    ARCHIVED = "archived"
    ALL = "all"


class WorkoutTemplateType(StrEnum):
    CARDIO = "cardio"
    STRENGTH = "strength"
    FLEXIBILITY = "flexibility"
    MIXED = "mixed"


class WorkoutSessionType(StrEnum):
    CARDIO = "cardio"
    STRENGTH = "strength"
    FLEXIBILITY = "flexibility"
    MIXED = "mixed"
    CUSTOM = "custom"


class WorkoutSessionSourceType(StrEnum):
    QUICK_START = "quick_start"
    PERSONAL_TEMPLATE = "personal_template"
    SYSTEM_TEMPLATE = "system_template"
    COMMUNITY_TEMPLATE = "community_template"
    PROGRAM_DAY = "program_day"
    PREVIOUS_SESSION = "previous_session"


class WorkoutSetType(StrEnum):
    WARMUP = "warmup"
    WORKING = "working"
    DROPSET = "dropset"
    FAILURE = "failure"


class WorkoutStatus(StrEnum):
    """Lifecycle status of a WorkoutSession (SPEC-005 §3)."""

    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkoutBlockType(StrEnum):
    """Training block grouping exercises within a session (SPEC-005 §24)."""

    NORMAL = "NORMAL"
    SUPERSET = "SUPERSET"
    TRISET = "TRISET"
    CIRCUIT = "CIRCUIT"


class ProgressionPolicy(StrEnum):
    """Supported progression policies (SPEC-005 §29)."""

    MANUAL = "MANUAL"
    LINEAR = "LINEAR"
    DOUBLE_PROGRESSION = "DOUBLE_PROGRESSION"
    RPE_BASED = "RPE_BASED"
    RIR_BASED = "RIR_BASED"
    PERCENT_1RM = "PERCENT_1RM"
    TIME_PROGRESSION = "TIME_PROGRESSION"


class ProgressionBulkSkipReason(StrEnum):
    """Why a bulk action left one selected target alone (SPEC-006 §58)."""

    # Unknown id, someone else's record, or one that is no longer an accepted
    # target (rejected or superseded by a newer recommendation).
    NOT_FOUND = "not_found"
    # The target is accepted and fine — its automatic prefill is just already off.
    ALREADY_DISABLED = "already_disabled"
    # The mirror case when the prefill is switched back on: this target never
    # had it off (SPEC §58 — undoing a bulk switch-off).
    ALREADY_ENABLED = "already_enabled"
    # Another selected target of the same scope is newer, and the edit reached
    # that scope already: a policy belongs to the scope, not to a record, so the
    # overlap is not edited (or named) a second time.
    SUPERSEDED = "superseded"


class PersonalRecordType(StrEnum):
    """Personal record types tracked per exercise (SPEC-005 §40)."""

    MAX_WEIGHT = "MAX_WEIGHT"
    MAX_REPS_AT_WEIGHT = "MAX_REPS_AT_WEIGHT"
    ESTIMATED_1RM = "ESTIMATED_1RM"
    MAX_VOLUME = "MAX_VOLUME"
    MAX_DURATION = "MAX_DURATION"


class ChallengeType(StrEnum):
    WORKOUT_COUNT = "workout_count"
    DURATION = "duration"
    CALORIES = "calories"
    DISTANCE = "distance"
    CUSTOM = "custom"


class ChallengeListStatus(StrEnum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ExportFormat(StrEnum):
    JSON = "json"
    CSV = "csv"
    XLSX = "xlsx"


class DataExportStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GlucoseMeasurementType(StrEnum):
    FASTING = "fasting"
    PRE_WORKOUT = "pre_workout"
    POST_WORKOUT = "post_workout"
    RANDOM = "random"
    BEDTIME = "bedtime"


class HealthDashboardPeriod(StrEnum):
    SEVEN_D = "7d"
    THIRTY_D = "30d"
    NINETY_D = "90d"
    ONE_Y = "1y"


class EmergencyRelationship(StrEnum):
    FAMILY = "family"
    FRIEND = "friend"
    DOCTOR = "doctor"
    TRAINER = "trainer"
    OTHER = "other"


class EmergencySeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class UserTheme(StrEnum):
    TELEGRAM = "telegram"
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class UserUnits(StrEnum):
    METRIC = "metric"
    IMPERIAL = "imperial"


class FitnessGoal(StrEnum):
    STRENGTH = "strength"
    WEIGHT_LOSS = "weight_loss"
    ENDURANCE = "endurance"


class ExperienceLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class AchievementCategoryFilter(StrEnum):
    WORKOUTS = "workouts"
    HEALTH = "health"
    STREAKS = "streaks"
    SOCIAL = "social"
    GENERAL = "general"


class AnalyticsPeriod(StrEnum):
    SEVEN_D = "7d"
    THIRTY_D = "30d"
    NINETY_D = "90d"
    ONE_Y = "1y"
    ALL = "all"


class TokenKind(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"
