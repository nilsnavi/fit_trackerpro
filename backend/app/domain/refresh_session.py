"""RefreshSession model — revocable, rotating refresh tokens (hashed at rest)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class RefreshSession(Base):
    """One issued refresh token.

    The raw token is never stored — only its SHA-256 hash. A family groups all
    tokens produced by successive rotations of one login; reuse of a revoked
    token revokes the whole family (theft detection).
    """

    __tablename__ = "refresh_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owning user",
    )
    jti: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True,
        comment="Unique token id (JWT jti claim)",
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="SHA-256 hex of the raw refresh token",
    )
    family_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="Rotation family (one login); reused token revokes the family",
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_jti: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_refresh_sessions_user_family", "user_id", "family_id"),
    )

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<RefreshSession(id={self.id}, user_id={self.user_id}, jti='{self.jti}')>"