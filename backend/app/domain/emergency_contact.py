"""
EmergencyContact Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class EmergencyContact(Base):
    """
    EmergencyContact model for storing user's emergency contacts
    Used for safety features during workouts
    """
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    contact_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Contact display name"
    )
    contact_username: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Telegram username (if Telegram user)"
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Phone number with country code"
    )

    # Relationship to user
    relationship_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Relationship: family, friend, doctor, trainer, other"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether contact is active"
    )

    # Notification preferences
    notify_on_workout_start: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Notify when workout starts"
    )
    notify_on_workout_end: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Notify when workout ends"
    )
    notify_on_emergency: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Notify on emergency alert"
    )

    # Priority order (1 = highest)
    priority: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Priority order for notifications"
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
        "User", back_populates="emergency_contacts")

    __table_args__ = (
        Index('ix_emergency_contacts_is_active', 'is_active'),
        Index('ix_emergency_contacts_priority', 'priority'),
        UniqueConstraint(
            "user_id",
            "contact_username",
            name="uq_emergency_contacts_user_contact_username",
        ),
        UniqueConstraint(
            "user_id",
            "phone",
            name="uq_emergency_contacts_user_phone",
        ),
        CheckConstraint(
            "priority >= 1 AND priority <= 10",
            name="ck_emergency_contacts_priority_range",
        ),
        CheckConstraint(
            "trim(contact_name) <> ''",
            name="ck_emergency_contacts_contact_name_not_blank",
        ),
        CheckConstraint(
            "(trim(COALESCE(contact_username, '')) <> '' OR trim(COALESCE(phone, '')) <> '')",
            name="ck_emergency_contacts_has_contact_channel",
        ),
    )

    def __repr__(self) -> str:
        return f"<EmergencyContact(id={self.id}, user_id={self.user_id}, name={self.contact_name})>"
