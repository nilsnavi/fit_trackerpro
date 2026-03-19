"""
Achievement Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from .user_achievement import UserAchievement


class Achievement(Base):
    """
    Achievement model for system achievements/badges
    Defines available achievements in the system
    """
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique achievement code"
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Achievement display name"
    )
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Achievement description"
    )
    icon_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL to achievement icon"
    )

    # Condition stored as JSONB for flexible achievement criteria
    condition: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Achievement unlock condition criteria"
    )

    # Points awarded for unlocking
    points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Points awarded for achievement"
    )

    # Achievement category
    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=False,
        comment="Category: workouts, health, streaks, social"
    )

    is_hidden: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="Hidden until unlocked"
    )

    # Display order for UI
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order in achievement list"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user_achievements: Mapped[list["UserAchievement"]] = relationship(
        "UserAchievement",
        back_populates="achievement",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('ix_achievements_code', 'code'),
        Index('ix_achievements_category', 'category'),
    )

    def __repr__(self) -> str:
        return f"<Achievement(id={self.id}, code={self.code}, name={self.name})>"
