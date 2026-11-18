"""One-time email challenges. Account and challenge mutations share a transaction."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.email_challenge import EmailChallenge
from app.domain.user import User
from app.infrastructure.email_delivery import deliver_email_code
from app.schemas.email_auth import EmailCodeVerify
from app.settings import settings


class EmailAuthError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail
        super().__init__(detail)


def _hash_code(challenge_id: str, code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), f"email-auth:{challenge_id}:{code}".encode(), hashlib.sha256
    ).hexdigest()


class EmailAuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def request_code(self, email: str, user_id: int | None = None) -> str:
        if not settings.AUTH_SMTP_HOST or not settings.AUTH_SMTP_FROM:
            raise EmailAuthError(503, "Отправка кодов временно недоступна.")

        now = datetime.now(timezone.utc)
        challenge_id = uuid4().hex
        code = f"{secrets.randbelow(1_000_000):06d}"
        values = {
            "challenge_id": challenge_id,
            "user_id": user_id,
            "code_hash": _hash_code(challenge_id, code),
            "attempts_left": 5,
            "sent_at": now,
            "expires_at": now + timedelta(minutes=10),
        }
        insert = pg_insert if self.db.get_bind().dialect.name == "postgresql" else sqlite_insert
        await self.db.execute(delete(EmailChallenge).where(EmailChallenge.expires_at <= now))
        result = await self.db.execute(
            insert(EmailChallenge)
            .values(email=email, **values)
            .on_conflict_do_update(
                index_elements=[EmailChallenge.email],
                set_=values,
                where=EmailChallenge.sent_at <= now - timedelta(minutes=1),
            )
            .returning(EmailChallenge.challenge_id)
        )
        if result.scalar_one_or_none() is None:
            await self.db.rollback()
            raise EmailAuthError(429, "Запросить новый код можно через минуту.")

        try:
            await deliver_email_code(email, code)
        except (OSError, ValueError):
            await self.db.rollback()
            raise EmailAuthError(503, "Не удалось отправить код. Попробуйте позже.") from None
        await self.db.commit()
        return challenge_id

    async def verify(self, payload: EmailCodeVerify, user_id: int | None = None) -> User:
        now = datetime.now(timezone.utc)
        invalid = EmailAuthError(400, "Код неверен или истёк. Проверьте код или запросите новый.")
        challenge = await self.db.scalar(
            select(EmailChallenge)
            .where(
                EmailChallenge.challenge_id == payload.challenge_id,
                EmailChallenge.user_id == user_id,
                EmailChallenge.expires_at > now,
                EmailChallenge.attempts_left > 0,
            )
            .with_for_update()
        )
        if challenge is None:
            raise invalid

        if not hmac.compare_digest(challenge.code_hash, _hash_code(payload.challenge_id, payload.code)):
            challenge.attempts_left -= 1
            await self.db.commit()
            raise invalid

        # Retain the send timestamp for the cooldown while immediately consuming the code.
        challenge.attempts_left = 0
        user = await self.db.scalar(select(User).where(User.email == challenge.email))
        if user_id is None and user is None:
            user = User(email=challenge.email, profile={"onboarding_completed": False})
            self.db.add(user)
        elif user_id is not None:
            if user is not None and user.id != user_id:
                await self.db.commit()
                raise EmailAuthError(409, "Этот адрес уже связан с другим аккаунтом.")
            user = await self.db.scalar(select(User).where(User.id == user_id).with_for_update())
            if user is None or (user.email is not None and user.email != challenge.email):
                await self.db.commit()
                raise EmailAuthError(409, "К аккаунту уже привязан другой адрес.")
            user.email = challenge.email

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise EmailAuthError(409, "Не удалось подтвердить адрес. Запросите новый код.") from None
        await self.db.refresh(user)
        return user
