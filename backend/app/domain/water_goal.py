"""
WaterGoal Model
User's daily water intake goal settings
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class WaterGoal(Base):
    """
    WaterGoal model for user's daily water intake goals
    """
    __tablename__ = "water_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    daily_goal: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2000,
        comment="Daily water goal in milliliters"
    )
    workout_increase: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=500,
        comment="Extra water on workout days in milliliters"
    )
    is_workout_day: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether today is a workout day"
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
    user: Mapped["User"] = relationship(
        "User",
        back_populates="water_goal",
    )

    __table_args__ = (
        CheckConstraint(
            "daily_goal >= 500 AND daily_goal <= 10000",
            name="ck_water_goals_daily_goal_range",
        ),
        CheckConstraint(
            "workout_increase >= 0 AND workout_increase <= 3000",
            name="ck_water_goals_workout_increase_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<WaterGoal(id={self.id}, user_id={self.user_id}, daily_goal={self.daily_goal}ml)>"
