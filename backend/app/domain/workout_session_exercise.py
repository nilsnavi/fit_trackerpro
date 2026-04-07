"""WorkoutSessionExercise model."""

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
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .template_exercise import TemplateExercise
    from .user import User
    from .workout_log import WorkoutLog
    from .workout_set import WorkoutSet


class WorkoutSessionExercise(Base):
    __tablename__ = "workout_session_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    source_template_exercise_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("template_exercises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    exercise_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="workout_session_exercises",
        overlaps="workout_session,session_exercises",
    )
    workout_session: Mapped["WorkoutLog"] = relationship(
        "WorkoutLog",
        back_populates="session_exercises",
        overlaps="user,workout_session_exercises",
    )
    source_template_exercise: Mapped[Optional["TemplateExercise"]] = relationship("TemplateExercise")
    sets: Mapped[list["WorkoutSet"]] = relationship(
        "WorkoutSet",
        back_populates="session_exercise",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.set_number",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "workout_session_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_session_exercises_user_session",
        ),
        CheckConstraint("order_index >= 0", name="ck_workout_session_exercises_order_index_non_negative"),
        CheckConstraint("exercise_id >= 1", name="ck_workout_session_exercises_exercise_positive"),
        Index("ix_workout_session_exercises_session_order", "workout_session_id", "order_index"),
    )
