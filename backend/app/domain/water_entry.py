"""
WaterEntry Model
Tracking daily water intake
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class WaterEntry(Base):
    """
    WaterEntry model for tracking daily water intake
    """
    __tablename__ = "water_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Water amount in milliliters"
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When the water was consumed"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="water_entries",
    )

    __table_args__ = (
        CheckConstraint(
            "amount >= 0 AND amount <= 10000",
            name="ck_water_entries_amount_range",
        ),
        Index('ix_water_entries_user_recorded_at', 'user_id', 'recorded_at'),
    )

    def __repr__(self) -> str:
        return f"<WaterEntry(id={self.id}, user_id={self.user_id}, amount={self.amount}ml)>"
