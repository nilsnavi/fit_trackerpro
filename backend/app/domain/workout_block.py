"""WorkoutBlock model.

Groups exercises of a workout session into training blocks
(NORMAL / SUPERSET / TRISET / CIRCUIT) per SPEC-005 §24.
"""
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
    from .user import User
    from .workout_log import WorkoutLog
    from .workout_session_exercise import WorkoutSessionExercise


class WorkoutBlock(Base):
    __tablename__ = "workout_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="NORMAL", server_default="NORMAL"
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rest_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="workout_blocks",
        overlaps="workout_session,workout_blocks",
    )
    workout_session: Mapped["WorkoutLog"] = relationship(
        "WorkoutLog",
        back_populates="workout_blocks",
        overlaps="user,workout_blocks",
    )
    session_exercises: Mapped[list["WorkoutSessionExercise"]] = relationship(
        "WorkoutSessionExercise",
        back_populates="workout_block",
        foreign_keys="WorkoutSessionExercise.block_id",
        order_by="WorkoutSessionExercise.block_order",
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "workout_session_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_workout_blocks_user_session",
        ),
        CheckConstraint(
            "type IN ('NORMAL','SUPERSET','TRISET','CIRCUIT')",
            name="ck_workout_blocks_type_allowed",
        ),
        CheckConstraint("rounds >= 1", name="ck_workout_blocks_rounds_positive"),
        CheckConstraint(
            "rest_seconds IS NULL OR rest_seconds >= 0",
            name="ck_workout_blocks_rest_non_negative",
        ),
        Index("ix_workout_blocks_session_order", "workout_session_id", "order"),
    )
