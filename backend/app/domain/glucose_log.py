"""
GlucoseLog Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .workout_log import WorkoutLog


class GlucoseLog(Base):
    """
    GlucoseLog model for tracking blood glucose levels
    Important for diabetic users monitoring workout impact
    """
    __tablename__ = "glucose_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    workout_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="Workout must belong to the same user (enforced by composite FK)",
    )
    value: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Blood glucose value in mmol/L"
    )
    measurement_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: fasting, pre_workout, post_workout, random, bedtime"
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When the measurement was taken"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Additional notes"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="glucose_logs",
        overlaps="workout,glucose_logs",
    )
    workout: Mapped[Optional["WorkoutLog"]] = relationship(
        "WorkoutLog",
        back_populates="glucose_logs",
        overlaps="user,glucose_logs",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "workout_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_glucose_logs_user_workout",
        ),
        CheckConstraint(
            "value >= 2 AND value <= 30",
            name="ck_glucose_logs_value_range",
        ),
        CheckConstraint(
            "measurement_type IN ('fasting','pre_workout','post_workout','random','bedtime')",
            name="ck_glucose_logs_measurement_type_allowed",
        ),
        Index('ix_glucose_logs_user_timestamp', 'user_id', 'timestamp'),
        Index('ix_glucose_logs_measurement_type', 'measurement_type'),
    )

    def __repr__(self) -> str:
        return f"<GlucoseLog(id={self.id}, user_id={self.user_id}, value={self.value})>"
