"""
Telegram WebApp Authentication endpoints
Handles user authentication via Telegram initData
"""
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.utils.config import settings
from app.utils.telegram_auth import (
    validate_and_get_user,
    validate_init_data_with_timestamp,
    get_user_from_init_data,
    TelegramAuthError
)
from app.middleware.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user_id,
    get_current_user
)
from app.schemas.auth import (
    TelegramAuthRequest,
    TelegramUserData,
    AuthResponse,
    UserProfileUpdate,
    UserProfileResponse,
    RefreshTokenRequest,
    LogoutResponse
)
from app.models import get_async_db, User

router = APIRouter()


# ============= Helper Functions =============

async def get_or_create_user(
    db: AsyncSession,
    telegram_user_data: dict
) -> User:
    """
    Get existing user or create new one from Telegram data

    Args:
        db: Database session
        telegram_user_data: User data from Telegram

    Returns:
        User model instance
    """
    telegram_id = telegram_user_data["id"]

    # Try to find existing user
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Create new user
        user = User(
            telegram_id=telegram_id,
            username=telegram_user_data.get("username"),
            first_name=telegram_user_data.get("first_name"),
            profile={
                "equipment": [],
                "limitations": [],
                "goals": []
            },
            settings={
                "theme": "telegram",
                "notifications": True,
                "units": "metric"
            }
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update user data from Telegram
        user.username = telegram_user_data.get("username") or user.username
        user.first_name = telegram_user_data.get(
            "first_name") or user.first_name
        await db.commit()

    return user


# ============= API Endpoints =============

@router.post("/telegram", response_model=AuthResponse)
async def authenticate_telegram(
    auth_request: TelegramAuthRequest,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Authenticate user via Telegram WebApp initData

    This endpoint validates the initData from Telegram WebApp,
    extracts user information, creates/updates the user in database,
    and returns JWT access token.

    **Request:**
    ```json
    {
        "init_data": "query_id=...&user={...}&auth_date=...&hash=..."
    }
    ```

    **Response:**
    ```json
    {
        "success": true,
        "message": "Authentication successful",
        "user": {
            "id": 123456789,
            "username": "johndoe",
            "first_name": "John",
            "last_name": "Doe",
            "language_code": "en",
            "is_premium": false,
            "photo_url": "https://...",
            "allows_write_to_pm": true
        },
        "access_token": "eyJhbGciOiJIUzI1NiIs...",
        "token_type": "bearer",
        "expires_in": 1800
    }
    ```
    """
    try:
        # Validate initData and extract user
        is_valid, user_data, error = validate_and_get_user(
            init_data=auth_request.init_data,
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            max_age_seconds=300  # 5 minutes
        )

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {error}"
            )

        # Get or create user in database
        user = await get_or_create_user(db, user_data)

        # Create JWT tokens
        access_token = create_access_token(user.telegram_id)
        refresh_token = create_refresh_token(user.telegram_id)

        # Map user data to response model
        user_response = TelegramUserData(
            id=user_data["id"],
            username=user_data.get("username"),
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name"),
            language_code=user_data.get("language_code"),
            is_premium=user_data.get("is_premium"),
            photo_url=user_data.get("photo_url"),
            allows_write_to_pm=user_data.get("allows_write_to_pm")
        )

        return AuthResponse(
            success=True,
            message="Authentication successful",
            user=user_response,
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user profile

    Requires valid JWT access token in Authorization header.

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "id": 1,
        "telegram_id": 123456789,
        "username": "johndoe",
        "first_name": "John",
        "profile": {
            "equipment": ["dumbbells", "barbell"],
            "limitations": [],
            "goals": ["strength", "weight_loss"]
        },
        "settings": {
            "theme": "telegram",
            "notifications": true,
            "units": "metric"
        },
        "created_at": "2024-01-15T10:30:00",
        "updated_at": "2024-01-20T14:45:00"
    }
    ```
    """
    return current_user


@router.put("/me", response_model=UserProfileResponse)
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update current user profile

    Requires valid JWT access token in Authorization header.

    **Request:**
    ```json
    {
        "first_name": "John",
        "last_name": "Doe",
        "profile": {
            "equipment": ["dumbbells", "resistance_bands"],
            "limitations": ["knee_pain"],
            "goals": ["muscle_gain", "endurance"]
        },
        "settings": {
            "theme": "dark",
            "notifications": true,
            "units": "imperial"
        }
    }
    ```

    **Response:** Updated user profile (same as GET /me)
    """
    update_data = profile_update.model_dump(exclude_unset=True)

    # Update fields
    for field, value in update_data.items():
        if field in ["profile", "settings"] and value is not None:
            # Merge nested dictionaries
            current_value = getattr(current_user, field, {}) or {}
            current_value.update(value)
            setattr(current_user, field, current_value)
        else:
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.post("/refresh")
async def refresh_token(
    refresh_request: RefreshTokenRequest
):
    """
    Refresh access token using refresh token

    **Request:**
    ```json
    {
        "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
    }
    ```

    **Response:**
    ```json
    {
        "access_token": "eyJhbGciOiJIUzI1NiIs...",
        "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
        "token_type": "bearer",
        "expires_in": 1800
    }
    ```
    """
    from app.middleware.auth import verify_token

    user_id = verify_token(refresh_request.refresh_token, token_type="refresh")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Create new tokens
    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    current_user: User = Depends(get_current_user)
):
    """
    Logout user

    Note: In production, implement token blacklisting in Redis
    to invalidate tokens before expiration.

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "message": "Successfully logged out"
    }
    ```
    """
    # TODO: Add token to Redis blacklist
    # For now, just return success
    return LogoutResponse()
