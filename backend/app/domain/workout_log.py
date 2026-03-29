"""
WorkoutLog Model
"""
from datetime import datetime, date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Integer,
    String,
    DateTime,
    Date,
    JSON,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .workout_template import WorkoutTemplate
    from .glucose_log import GlucoseLog


class WorkoutLog(Base):
    """
    WorkoutLog model for tracking completed workouts
    Stores actual performed exercises with results
    """
    __tablename__ = "workout_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    template_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="Template must belong to the same user (enforced by composite FK)",
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Workout date"
    )
    duration: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Duration in minutes"
    )

    # Completed exercises stored as JSONB
    exercises: Mapped[list[dict]] = mapped_column(
        JSON,
        default=list,
        comment="Completed exercises with actual sets, reps, weight"
    )

    comments: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True,
        comment="User notes about the workout"
    )
    tags: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        comment="Tags for categorizing workouts"
    )

    # Glucose tracking for diabetic users
    glucose_before: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="Blood glucose before workout (mmol/L)"
    )
    glucose_after: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="Blood glucose after workout (mmol/L)"
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

    # Relationships (composite FKs share user_id; overlaps silences mapper warnings)
    user: Mapped["User"] = relationship(
        "User",
        back_populates="workout_logs",
        overlaps="template,workout_logs",
    )
    template: Mapped[Optional["WorkoutTemplate"]] = relationship(
        "WorkoutTemplate",
        back_populates="workout_logs",
        overlaps="user,workout_logs",
    )
    glucose_logs: Mapped[list["GlucoseLog"]] = relationship(
        "GlucoseLog",
        back_populates="workout",
        cascade="all, delete-orphan",
        overlaps="glucose_logs",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "id",
            name="uq_workout_logs_user_id",
        ),
        ForeignKeyConstraint(
            ["user_id", "template_id"],
            ["workout_templates.user_id", "workout_templates.id"],
            ondelete="SET NULL",
            name="fk_workout_logs_user_template",
        ),
        Index('ix_workout_logs_user_date', 'user_id', 'date'),
    )

    def __repr__(self) -> str:
        return f"<WorkoutLog(id={self.id}, user_id={self.user_id}, date={self.date})>"
