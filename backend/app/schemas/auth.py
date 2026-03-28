"""
Auth Schemas
Pydantic models for authentication endpoints
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    """Request model for Telegram authentication"""
    init_data: str = Field(
        ...,
        description="Raw initData string from Telegram WebApp",
        examples=["query_id=...&user={...}&auth_date=...&hash=..."]
    )


class TelegramUserData(BaseModel):
    """Telegram user data model"""

    id: int = Field(..., description="Telegram user ID")
    username: Optional[str] = Field(None, description="Username")
    first_name: str = Field(..., description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    language_code: Optional[str] = Field(None, description="Language code")
    is_premium: Optional[bool] = Field(
        None, description="Is Telegram Premium user")
    photo_url: Optional[str] = Field(None, description="Profile photo URL")
    allows_write_to_pm: Optional[bool] = Field(
        None, description="Allows writing to PM")


class AuthResponse(BaseModel):
    """Authentication response"""
    success: bool
    message: str
    user: Optional[TelegramUserData] = None
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = Field(
        None, description="Token expiration in seconds")


class UserProfileUpdate(BaseModel):
    """Request model for updating user profile"""
    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)
    profile: Optional[dict] = Field(
        None,
        description="User profile data: equipment, limitations, goals"
    )
    settings: Optional[dict] = Field(
        None,
        description="User settings: theme, notifications, units"
    )


class UserProfileResponse(BaseModel):
    """User profile response (API contract; not an ORM model)."""

    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    profile: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


def user_profile_from_db(user) -> UserProfileResponse:
    """Map persisted user row to API DTO (no ORM in route handlers)."""
    return UserProfileResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        profile=dict(user.profile or {}),
        settings=dict(user.settings or {}),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: int = Field(..., description="User ID (subject)")
    exp: int = Field(..., description="Expiration timestamp")
    iat: int = Field(..., description="Issued at timestamp")
    type: str = Field(default="access", description="Token type")


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str = Field(..., description="Refresh token")


class RefreshTokenResponse(BaseModel):
    """Token refresh response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")


class LogoutResponse(BaseModel):
    """Logout response"""
    message: str = "Successfully logged out"
