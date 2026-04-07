"""Shared string enums for API request validation (OpenAPI + consistent 422 errors)."""

from __future__ import annotations

from enum import StrEnum


class ExerciseCategory(StrEnum):
    STRENGTH = "strength"
    CARDIO = "cardio"
    FLEXIBILITY = "flexibility"
    BALANCE = "balance"
    SPORT = "sport"


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


class WorkoutSetType(StrEnum):
    WARMUP = "warmup"
    WORKING = "working"
    DROPSET = "dropset"
    FAILURE = "failure"


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
