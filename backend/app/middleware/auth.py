"""
JWT authentication dependencies (FastAPI ``Depends``).

Used by route handlers and by ``app.api.deps.auth.ROUTER_DEPENDENCIES_AUTHENTICATED`` for
mount-level guards. There is no global auth middleware: public vs protected routes are
declared in ``app.api.v1.registration`` (system, login, refresh, public user create/lookup
are unauthenticated; everything else under ``/api/v1`` that is mounted with
``ROUTER_DEPENDENCIES_AUTHENTICATED`` requires a Bearer access token).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from app.core.security import security, verify_token
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.infrastructure.repositories.auth_repository import AuthRepository


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    Dependency to get current user ID from JWT token

    Args:
        credentials: HTTP Authorization credentials

    Returns:
        User ID

    Raises:
        HTTPException: If token is invalid or missing
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if credentials.scheme != "Bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Use Bearer",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = verify_token(credentials.credentials)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user_id


async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_db)
) -> User:
    """
    Dependency to get current authenticated user

    Args:
        user_id: User ID from token
        db: Database session

    Returns:
        User model instance

    Raises:
        HTTPException: If user not found
    """
    user = await AuthRepository(db).get_user_by_telegram_id(telegram_id=user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to get current active user

    Args:
        current_user: User from get_current_user

    Returns:
        User model instance

    Raises:
        HTTPException: If user is inactive
    """
    # Add any additional checks for active status
    # For now, just return the user
    return current_user


async def require_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency to require admin privileges

    Args:
        current_user: User from get_current_active_user

    Returns:
        User model instance

    Raises:
        HTTPException: If user is not admin
    """
    # Check if user has admin role in settings
    # For now, check if telegram_id is in a list of admin IDs
    admin_ids = getattr(settings, 'ADMIN_USER_IDS', [])

    if current_user.telegram_id not in admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    return current_user
