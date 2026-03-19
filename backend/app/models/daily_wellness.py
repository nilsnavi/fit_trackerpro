"""
DailyWellness Model
"""
from datetime import datetime, date
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, DateTime, Date, JSON, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from .user import User


class DailyWellness(Base):
    """
    DailyWellness model for tracking daily wellness metrics
    Sleep, energy levels, pain tracking
    """
    __tablename__ = "daily_wellness"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date of wellness entry"
    )

    # Sleep tracking (0-100 scale)
    sleep_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sleep quality score 0-100"
    )
    sleep_hours: Mapped[float] = mapped_column(
        Numeric(4, 1),
        nullable=True,
        comment="Hours of sleep"
    )

    # Energy level (0-100 scale)
    energy_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Energy level score 0-100"
    )

    # Pain tracking stored as JSONB
    pain_zones: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "head": 0,
            "neck": 0,
            "shoulders": 0,
            "chest": 0,
            "back": 0,
            "arms": 0,
            "wrists": 0,
            "hips": 0,
            "knees": 0,
            "ankles": 0
        },
        comment="Pain levels by body zone (0-10 scale)"
    )

    # Additional wellness metrics
    stress_level: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
        comment="Stress level 0-10"
    )
    mood_score: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
        comment="Mood score 0-100"
    )

    notes: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
        comment="Additional notes"
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
        "User", back_populates="daily_wellness_entries")

    __table_args__ = (
        Index('ix_daily_wellness_user_id', 'user_id'),
        Index('ix_daily_wellness_date', 'date'),
        Index('ix_daily_wellness_user_date', 'user_id', 'date', unique=True),
        Index('ix_daily_wellness_sleep_score', 'sleep_score'),
        Index('ix_daily_wellness_energy_score', 'energy_score'),
    )

    def __repr__(self) -> str:
        return f"<DailyWellness(id={self.id}, user_id={self.user_id}, date={self.date})>"
