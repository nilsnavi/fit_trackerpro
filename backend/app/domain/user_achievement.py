"""
UserAchievement Model (Association Table)
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Integer, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .achievement import Achievement


class UserAchievement(Base):
    """
    UserAchievement association model
    Tracks which achievements users have unlocked
    """
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    achievement_id: Mapped[int] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When achievement was unlocked"
    )

    # Progress tracking (for multi-step achievements)
    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Current progress toward achievement"
    )
    progress_data: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        comment="Additional progress tracking data"
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="achievements")
    achievement: Mapped["Achievement"] = relationship(
        "Achievement", back_populates="user_achievements")

    __table_args__ = (
        Index(
            'ix_user_achievements_user_achievement',
            'user_id',
            'achievement_id',
            unique=True,
        ),
        Index('ix_user_achievements_earned_at', 'earned_at'),
    )

    def __repr__(self) -> str:
        return f"<UserAchievement(user_id={self.user_id}, achievement_id={self.achievement_id})>"
