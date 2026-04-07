"""TemplateExercise model."""

from __future__ import annotations

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
    from .exercise import Exercise
    from .user import User
    from .workout_template import WorkoutTemplate


class TemplateExercise(Base):
    __tablename__ = "template_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="template_exercises",
        overlaps="template,template_exercises",
    )
    template: Mapped["WorkoutTemplate"] = relationship(
        "WorkoutTemplate",
        back_populates="template_exercises",
        overlaps="user,template_exercises",
    )
    exercise: Mapped["Exercise"] = relationship("Exercise")

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "template_id"],
            ["workout_templates.user_id", "workout_templates.id"],
            ondelete="CASCADE",
            name="fk_template_exercises_user_template",
        ),
        CheckConstraint("order_index >= 0", name="ck_template_exercises_order_index_non_negative"),
        CheckConstraint("sets >= 1 AND sets <= 20", name="ck_template_exercises_sets_range"),
        CheckConstraint("reps IS NULL OR reps >= 0", name="ck_template_exercises_reps_non_negative"),
        CheckConstraint("duration IS NULL OR duration >= 0", name="ck_template_exercises_duration_non_negative"),
        CheckConstraint("rest_seconds >= 0 AND rest_seconds <= 600", name="ck_template_exercises_rest_seconds_range"),
        CheckConstraint("weight IS NULL OR weight >= 0", name="ck_template_exercises_weight_non_negative"),
        Index("ix_template_exercises_template_order", "template_id", "order_index"),
    )
