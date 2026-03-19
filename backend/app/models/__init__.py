"""
FitTracker Pro Database Models
SQLAlchemy ORM models for PostgreSQL database
"""
from .user import User
from .workout_template import WorkoutTemplate
from .workout_log import WorkoutLog
from .exercise import Exercise
from .glucose_log import GlucoseLog
from .daily_wellness import DailyWellness
from .achievement import Achievement
from .user_achievement import UserAchievement
from .challenge import Challenge
from .emergency_contact import EmergencyContact
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.utils.config import settings
from app.models.base import Base

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
