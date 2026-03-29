"""
User management: public registration/lookup vs authenticated ``/me`` subtree.

Public: ``POST /`` (create), ``GET /{user_id}`` (read by id).
Protected: ``/me`` (profile read, patch, delete) — Bearer access token.
"""
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.auth_service import AuthService
from app.application.users_service import UsersService
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.auth import UserProfileResponse, UserProfileUpdate
from app.schemas.users import UserCreate, UserResponse

public_users_router = APIRouter()

protected_users_router = APIRouter()


@public_users_router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_async_db)):
    """Create or update user from Telegram data"""
    service = UsersService(db)
    return await service.create_user(user)


@public_users_router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_async_db)):
    """Get user by ID"""
    service = UsersService(db)
    return await service.get_user_by_id(user_id)


@protected_users_router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Current user profile (same contract as ``/users/auth/me``)."""
    return AuthService.get_profile(current_user)


@protected_users_router.patch("/me", response_model=UserProfileResponse)
async def patch_current_user_profile(
    profile_update: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Partial profile update."""
    service = AuthService(db)
    return await service.update_profile(
        current_user=current_user,
        profile_update=profile_update,
        client_ip=get_client_ip(request),
    )


@protected_users_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Delete the authenticated user account."""
    service = AuthService(db)
    await service.delete_account(current_user, client_ip=get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
