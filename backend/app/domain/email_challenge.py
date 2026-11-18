from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.base import Base


class EmailChallenge(Base):
    __tablename__ = "email_auth_challenges"

    email: Mapped[str] = mapped_column(String(254), primary_key=True)
    challenge_id: Mapped[str] = mapped_column(String(32), unique=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts_left: Mapped[int]
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
