"""
JWT encoding/decoding and HTTP Bearer scheme (no FastAPI route dependencies).
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=7)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
    }

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_token(token: str, token_type: str = "access") -> Optional[int]:
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

        return user_id

    except (JWTError, ValueError, TypeError):
        return None


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
