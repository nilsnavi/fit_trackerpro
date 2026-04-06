"""
Exercise Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class Exercise(Base):
    """
    Exercise model for exercise library
    Can be system exercises or user-created exercises
    """
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Exercise name"
    )
    slug: Mapped[Optional[str]] = mapped_column(
        String(180),
        nullable=True,
        index=True,
        comment="Stable identifier for system catalog (nullable for legacy/user exercises)",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(2000),
        nullable=True,
        comment="Exercise description and instructions"
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Category: strength, cardio, flexibility, balance, sport"
    )

    # Equipment needed stored as JSONB array
    equipment: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        comment="Required equipment list"
    )

    # Muscle groups targeted stored as JSONB array
    muscle_groups: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        comment="Target muscle groups"
    )

    # Risk flags for users with limitations stored as JSONB
    risk_flags: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "high_blood_pressure": False,
            "diabetes": False,
            "joint_problems": False,
            "back_problems": False,
            "heart_conditions": False
        },
        comment="Risk flags for health conditions"
    )

    media_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL to video/image demonstration"
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        nullable=False,
        comment="Status: active, pending, archived"
    )

    source: Mapped[str] = mapped_column(
        String(16),
        default="system",
        nullable=False,
        comment="Source: system, user, imported",
    )

    author_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Null for system exercises, user_id for custom"
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
    author: Mapped[Optional["User"]] = relationship(
        "User", back_populates="authored_exercises")

    __table_args__ = (
        Index('ix_exercises_status', 'status'),
        Index('ix_exercises_created_at', 'created_at'),
        Index('ix_exercises_source', 'source'),
        CheckConstraint(
            "category IN ('strength','cardio','flexibility','balance','sport')",
            name="ck_exercises_category_allowed",
        ),
        CheckConstraint(
            "status IN ('active','pending','archived')",
            name="ck_exercises_status_allowed",
        ),
        CheckConstraint(
            "source IN ('system','user','imported')",
            name="ck_exercises_source_allowed",
        ),
    )

    def __repr__(self) -> str:
        return f"<Exercise(id={self.id}, name={self.name}, category={self.category})>"
