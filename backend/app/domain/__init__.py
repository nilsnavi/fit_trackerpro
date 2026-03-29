"""
Domain layer: SQLAlchemy ORM entities, database engine, and async session.
"""
from .user import User
from .workout_template import WorkoutTemplate
from .workout_log import WorkoutLog
from .exercise import Exercise
from .glucose_log import GlucoseLog
from .daily_wellness import DailyWellness
from .training_load_daily import TrainingLoadDaily
from .muscle_load import MuscleLoad
from .recovery_state import RecoveryState
from .achievement import Achievement
from .user_achievement import UserAchievement
from .challenge import Challenge
from .emergency_contact import EmergencyContact
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.settings import settings
from app.domain.base import Base

# Database engines
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Session makers
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Import all models AFTER Base is defined

__all__ = [
    "Base",
    "User",
    "WorkoutTemplate",
    "WorkoutLog",
    "Exercise",
    "GlucoseLog",
    "DailyWellness",
    "TrainingLoadDaily",
    "MuscleLoad",
    "RecoveryState",
    "Achievement",
    "UserAchievement",
    "Challenge",
    "EmergencyContact",
]


async def get_async_db():
    """Dependency for getting async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
