"""
WorkoutTemplate Model
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Integer,
    String,
    DateTime,
    JSON,
    Boolean,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .workout_log import WorkoutLog


class WorkoutTemplate(Base):
    """
    WorkoutTemplate model for storing reusable workout templates
    Exercises are stored as JSONB for flexibility
    """
    __tablename__ = "workout_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Template name"
    )
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Workout type: cardio, strength, flexibility, mixed"
    )

    # Exercises stored as JSONB array
    exercises: Mapped[list[dict]] = mapped_column(
        JSON,
        default=list,
        comment="List of exercises with sets, reps, duration"
    )

    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="Whether template is publicly available"
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
        "User", back_populates="workout_templates")
    workout_logs: Mapped[list["WorkoutLog"]] = relationship(
        "WorkoutLog",
        back_populates="template",
        overlaps="workout_logs",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "id",
            name="uq_workout_templates_user_id",
        ),
        CheckConstraint(
            "type IN ('cardio','strength','flexibility','mixed')",
            name="ck_workout_templates_type_allowed",
        ),
        Index('ix_workout_templates_type', 'type'),
        Index('ix_workout_templates_is_public', 'is_public'),
        Index('ix_workout_templates_created_at', 'created_at'),
    )

    def __repr__(self) -> str:
        return f"<WorkoutTemplate(id={self.id}, name={self.name}, user_id={self.user_id})>"
