"""
User Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, BigInteger, String, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .workout_template import WorkoutTemplate
    from .workout_log import WorkoutLog
    from .glucose_log import GlucoseLog
    from .daily_wellness import DailyWellness
    from .training_load_daily import TrainingLoadDaily
    from .muscle_load import MuscleLoad
    from .recovery_state import RecoveryState
    from .user_achievement import UserAchievement
    from .challenge import Challenge
    from .emergency_contact import EmergencyContact


class User(Base):
    """
    User model for Telegram users
    Stores user profile, settings and relationships
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    telegram_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        nullable=False,
        index=True,
        comment="Telegram user ID"
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Telegram username"
    )
    first_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Telegram first name"
    )

    # Profile data stored as JSONB
    profile: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "equipment": [],
            "limitations": [],
            "goals": []
        },
        comment="User profile: equipment, limitations, goals"
    )

    # Settings stored as JSONB
    settings: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "theme": "telegram",
            "notifications": True,
            "units": "metric"
        },
        comment="User settings: theme, notifications, units"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    workout_templates: Mapped[list["WorkoutTemplate"]] = relationship(
        "WorkoutTemplate",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    workout_logs: Mapped[list["WorkoutLog"]] = relationship(
        "WorkoutLog",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    glucose_logs: Mapped[list["GlucoseLog"]] = relationship(
        "GlucoseLog",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    daily_wellness_entries: Mapped[list["DailyWellness"]] = relationship(
        "DailyWellness",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    training_load_daily_entries: Mapped[list["TrainingLoadDaily"]] = relationship(
        "TrainingLoadDaily",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    muscle_load_entries: Mapped[list["MuscleLoad"]] = relationship(
        "MuscleLoad",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    recovery_state: Mapped[Optional["RecoveryState"]] = relationship(
        "RecoveryState",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    achievements: Mapped[list["UserAchievement"]] = relationship(
        "UserAchievement",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    created_challenges: Mapped[list["Challenge"]] = relationship(
        "Challenge",
        back_populates="creator",
        cascade="all, delete-orphan"
    )
    emergency_contacts: Mapped[list["EmergencyContact"]] = relationship(
        "EmergencyContact",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    authored_exercises: Mapped[list["Exercise"]] = relationship(
        "Exercise",
        back_populates="author",
        cascade="all, delete-orphan"
    )

    __table_args__ = (Index('ix_users_created_at', 'created_at'),)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, telegram_id={self.telegram_id}, username={self.username})>"
