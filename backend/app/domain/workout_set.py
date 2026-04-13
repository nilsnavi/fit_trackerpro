"""WorkoutSet model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .workout_log import WorkoutLog
    from .workout_session_exercise import WorkoutSessionExercise


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    workout_session_exercise_id: Mapped[int] = mapped_column(
        ForeignKey("workout_session_exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    set_type: Mapped[str] = mapped_column(String(16), nullable=False, default="working", server_default="working")
    reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    # Subjective difficulty: 1-10 scale (nullable for legacy data).
    rpe: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rir: Mapped[Optional[float]] = mapped_column(Numeric(3, 1), nullable=True)
    planned_rest_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actual_rest_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Single-field rest tracking for set-to-set timer UX.
    rest_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="workout_sets",
        overlaps="workout_session,workout_sets",
    )
    workout_session: Mapped["WorkoutLog"] = relationship(
        "WorkoutLog",
        back_populates="workout_sets",
        overlaps="user,workout_sets",
    )
    session_exercise: Mapped["WorkoutSessionExercise"] = relationship(
        "WorkoutSessionExercise", back_populates="sets"
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "workout_session_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_workout_sets_user_session",
        ),
        CheckConstraint("set_number >= 1", name="ck_workout_sets_set_number_positive"),
        CheckConstraint(
            "set_type IN ('warmup','working','dropset','failure')",
            name="ck_workout_sets_set_type_allowed",
        ),
        CheckConstraint("reps IS NULL OR reps >= 0", name="ck_workout_sets_reps_non_negative"),
        CheckConstraint("weight IS NULL OR weight >= 0", name="ck_workout_sets_weight_non_negative"),
        CheckConstraint("rpe IS NULL OR (rpe >= 1 AND rpe <= 10)", name="ck_workout_sets_rpe_range"),
        CheckConstraint("rir IS NULL OR (rir >= 0 AND rir <= 10)", name="ck_workout_sets_rir_range"),
        CheckConstraint(
            "planned_rest_seconds IS NULL OR planned_rest_seconds >= 0",
            name="ck_workout_sets_planned_rest_non_negative",
        ),
        CheckConstraint(
            "actual_rest_seconds IS NULL OR actual_rest_seconds >= 0",
            name="ck_workout_sets_actual_rest_non_negative",
        ),
        CheckConstraint(
            "rest_seconds IS NULL OR rest_seconds >= 0",
            name="ck_workout_sets_rest_non_negative",
        ),
        CheckConstraint("duration IS NULL OR duration >= 0", name="ck_workout_sets_duration_non_negative"),
        Index("ix_workout_sets_session_exercise_number", "workout_session_exercise_id", "set_number"),
        Index("ix_workout_sets_user_session", "user_id", "workout_session_id"),
    )
