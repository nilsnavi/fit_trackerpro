"""
User management endpoints
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import User
from app.infrastructure.database import get_async_db
from app.middleware.auth import get_current_user
from app.schemas.auth import UserProfileResponse, UserProfileUpdate, user_profile_from_db
from app.application.auth_service import AuthService

router = APIRouter()


class UserCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    created_at: datetime
    updated_at: datetime


@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Create or update user from Telegram data"""
    # TODO: Implement user creation logic
    return {
        "id": 1,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Current user profile (same contract as /users/auth/me)."""
    return user_profile_from_db(current_user)


@router.patch("/me", response_model=UserProfileResponse)
async def patch_current_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Partial profile update."""
    service = AuthService(db)
    return await service.update_profile(
        current_user=current_user, profile_update=profile_update
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Delete the authenticated user account."""
    await db.delete(current_user)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Get user by ID"""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )
