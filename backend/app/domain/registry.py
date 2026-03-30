"""
Register all ORM models on ``Base.metadata`` (import side effects).

Use ``import app.domain.registry`` next to ``Base`` wherever the full schema
must be visible (database engine, migrations, tests). Application code should
import entities from their modules, e.g. ``from app.domain.user import User``,
to avoid loading the entire model graph through ``app.domain``.
"""

from app.domain.user import User  # noqa: F401
from app.domain.workout_template import WorkoutTemplate  # noqa: F401
from app.domain.workout_log import WorkoutLog  # noqa: F401
from app.domain.exercise import Exercise  # noqa: F401
from app.domain.reference_data import (  # noqa: F401
    RefEquipment,
    RefExerciseCategory,
    RefExerciseStatus,
    RefMuscleGroup,
    ReferenceDataApplied,
)
from app.domain.glucose_log import GlucoseLog  # noqa: F401
from app.domain.daily_wellness import DailyWellness  # noqa: F401
from app.domain.training_load_daily import TrainingLoadDaily  # noqa: F401
from app.domain.muscle_load import MuscleLoad  # noqa: F401
from app.domain.recovery_state import RecoveryState  # noqa: F401
from app.domain.achievement import Achievement  # noqa: F401
from app.domain.user_achievement import UserAchievement  # noqa: F401
from app.domain.challenge import Challenge  # noqa: F401
from app.domain.emergency_contact import EmergencyContact  # noqa: F401
