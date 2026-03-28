"""
Telegram WebApp Authentication endpoints
HTTP-only endpoints delegating business logic to services
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain import User, get_async_db
from app.schemas.auth import (
    AuthResponse,
    LogoutResponse,
    RefreshTokenRequest,
    TelegramAuthRequest,
    UserProfileResponse,
    UserProfileUpdate,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/telegram", response_model=AuthResponse)
async def authenticate_telegram(
    auth_request: TelegramAuthRequest,
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    try:
        return await service.authenticate_telegram(auth_request=auth_request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(exc)}",
        ) from exc


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserProfileResponse)
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    return await service.update_profile(current_user=current_user, profile_update=profile_update)


@router.post("/refresh")
async def refresh_token(refresh_request: RefreshTokenRequest):
    return AuthService.refresh_token(refresh_request=refresh_request)


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: User = Depends(get_current_user)):
    return AuthService.logout()
