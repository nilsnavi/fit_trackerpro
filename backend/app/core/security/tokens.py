"""
JWT encoding/decoding and HTTP Bearer scheme (no FastAPI route dependencies).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError as JWTError

from app.settings import settings

security = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "access",
    }

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


REFRESH_TOKEN_TTL = timedelta(days=7)


def refresh_token_expires_at(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) + REFRESH_TOKEN_TTL


def create_refresh_token(
    user_id: int,
    generation: str | UUID | None = None,
    *,
    jti: str | None = None,
    family_id: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = refresh_token_expires_at(now)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now,
        "type": "refresh",
    }
    if generation is not None:
        to_encode["generation"] = str(generation)
    if jti is not None:
        to_encode["jti"] = jti
    if family_id is not None:
        to_encode["family_id"] = family_id

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_token(
    token: str,
    token_type: str = "access",
    *,
    include_generation: bool = False,
) -> Optional[int] | tuple[int, str | None]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        if payload.get("type") != token_type:
            return None

        user_id = int(payload.get("sub"))
        if user_id is None:
            return None

        if include_generation:
            generation = payload.get("generation")
            return user_id, generation if isinstance(generation, str) else None
        return user_id

    except (JWTError, ValueError, TypeError):
        return None


def decode_refresh_token(token: str) -> dict | None:
    """Return refresh-token claims (sub/jti/family_id/generation/exp) or ``None``."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except (JWTError, ValueError, TypeError):
        return None
    if payload.get("type") != "refresh":
        return None
    return payload


class JWTBearer(HTTPBearer):
    """Custom JWT Bearer security class."""

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request) -> Optional[int]:
        credentials: HTTPAuthorizationCredentials | None = await super().__call__(request)

        if credentials:
            if credentials.scheme != "Bearer":
                return None

            user_id = verify_token(credentials.credentials)
            if user_id is None:
                return None

            return user_id

        return None
