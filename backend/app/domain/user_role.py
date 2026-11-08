from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from app.domain.user import User


class UserRoleName(StrEnum):
    COACH = "COACH"
    SUPER_ADMIN = "SUPER_ADMIN"
    GYM_ADMIN = "GYM_ADMIN"


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[UserRoleName] = mapped_column(
        SAEnum(UserRoleName, native_enum=False, values_callable=lambda enum: [item.value for item in enum], length=32),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="roles")

    __table_args__ = (
        Index("ix_user_roles_user_id", "user_id"),
        UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
        CheckConstraint("role IN ('COACH', 'SUPER_ADMIN', 'GYM_ADMIN')", name="ck_user_roles_allowed_role"),
    )
