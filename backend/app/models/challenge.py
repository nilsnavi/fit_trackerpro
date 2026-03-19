"""
Challenge Model
"""
from datetime import datetime, date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, DateTime, Date, JSON, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from .user import User


class Challenge(Base):
    """
    Challenge model for fitness challenges
    Users can create and participate in challenges
    """
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Challenge name"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(2000),
        nullable=True,
        comment="Challenge description"
    )
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: workout_count, duration, calories, distance, custom"
    )

    # Challenge goal stored as JSONB
    goal: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Challenge goal criteria"
    )

    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Challenge start date"
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Challenge end date"
    )

    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether challenge is publicly joinable"
    )

    # Join code for private challenges
    join_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        unique=True,
        comment="Code to join private challenge"
    )

    # Max participants (0 = unlimited)
    max_participants: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Max participants, 0 = unlimited"
    )

    # Challenge rules stored as JSONB
    rules: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        comment="Challenge rules and restrictions"
    )

    # Banner image
    banner_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Challenge banner image URL"
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="upcoming",
        nullable=False,
        comment="Status: upcoming, active, completed, cancelled"
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
    creator: Mapped["User"] = relationship(
        "User", back_populates="created_challenges")

    __table_args__ = (
        Index('ix_challenges_creator_id', 'creator_id'),
        Index('ix_challenges_type', 'type'),
        Index('ix_challenges_start_date', 'start_date'),
        Index('ix_challenges_end_date', 'end_date'),
        Index('ix_challenges_is_public', 'is_public'),
        Index('ix_challenges_status', 'status'),
        Index('ix_challenges_join_code', 'join_code'),
    )

    def __repr__(self) -> str:
        return f"<Challenge(id={self.id}, name={self.name}, creator_id={self.creator_id})>"
