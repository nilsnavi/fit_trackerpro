"""
FitTracker Pro - Pydantic Schemas
Request/Response models for API validation
"""

from .auth import (
    TelegramAuthRequest,
    TelegramUserData,
    AuthResponse,
    UserProfileUpdate,
    UserProfileResponse,
)

from .workouts import (
    WorkoutTemplateCreate,
    WorkoutTemplateResponse,
    WorkoutTemplateList,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryResponse,
    ExerciseInTemplate,
    CompletedExercise,
)

from .exercises import (
    ExerciseCreate,
    ExerciseUpdate,
    ExerciseResponse,
    ExerciseListResponse,
    ExerciseFilterParams,
)

from .health import (
    GlucoseLogCreate,
    GlucoseLogResponse,
    GlucoseHistoryResponse,
    DailyWellnessCreate,
    DailyWellnessResponse,
    HealthStatsResponse,
)

from .analytics import (
    ExerciseProgressResponse,
    WorkoutCalendarResponse,
    CalendarDayEntry,
    DataExportRequest,
    DataExportResponse,
    TrainingLoadDailyEntry,
    TrainingLoadDailyTableResponse,
    MuscleLoadEntry,
    MuscleLoadTableResponse,
    RecoveryStateResponse,
    RecoveryStateRecalculateResponse,
)

from .achievements import (
    AchievementResponse,
    AchievementListResponse,
    UserAchievementResponse,
    UserAchievementListResponse,
)

from .challenges import (
    ChallengeCreate,
    ChallengeResponse,
    ChallengeListResponse,
    ChallengeJoinResponse,
)

from .emergency import (
    EmergencyContactCreate,
    EmergencyContactResponse,
    EmergencyContactListResponse,
    EmergencyNotifyRequest,
    EmergencyNotifyResponse,
)

__all__ = [
    # Auth
    "TelegramAuthRequest",
    "TelegramUserData",
    "AuthResponse",
    "UserProfileUpdate",
    "UserProfileResponse",
    # Workouts
    "WorkoutTemplateCreate",
    "WorkoutTemplateResponse",
    "WorkoutTemplateList",
    "WorkoutStartRequest",
    "WorkoutStartResponse",
    "WorkoutCompleteRequest",
    "WorkoutCompleteResponse",
    "WorkoutHistoryResponse",
    "ExerciseInTemplate",
    "CompletedExercise",
    # Exercises
    "ExerciseCreate",
    "ExerciseUpdate",
    "ExerciseResponse",
    "ExerciseListResponse",
    "ExerciseFilterParams",
    # Health
    "GlucoseLogCreate",
    "GlucoseLogResponse",
    "GlucoseHistoryResponse",
    "DailyWellnessCreate",
    "DailyWellnessResponse",
    "HealthStatsResponse",
    # Analytics
    "ExerciseProgressResponse",
    "WorkoutCalendarResponse",
    "CalendarDayEntry",
    "DataExportRequest",
    "DataExportResponse",
    "TrainingLoadDailyEntry",
    "TrainingLoadDailyTableResponse",
    "MuscleLoadEntry",
    "MuscleLoadTableResponse",
    "RecoveryStateResponse",
    "RecoveryStateRecalculateResponse",
    # Achievements
    "AchievementResponse",
    "AchievementListResponse",
    "UserAchievementResponse",
    "UserAchievementListResponse",
    # Challenges
    "ChallengeCreate",
    "ChallengeResponse",
    "ChallengeListResponse",
    "ChallengeJoinResponse",
    # Emergency
    "EmergencyContactCreate",
    "EmergencyContactResponse",
    "EmergencyContactListResponse",
    "EmergencyNotifyRequest",
    "EmergencyNotifyResponse",
]
