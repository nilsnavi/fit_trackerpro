"""
Auth Schemas
Pydantic models for authentication endpoints
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TelegramAuthRequest(BaseModel):
    """Request model for Telegram authentication"""
    init_data: str = Field(
        ...,
        description="Raw initData string from Telegram WebApp",
        examples=["query_id=...&user={...}&auth_date=...&hash=..."]
    )


class TelegramUserData(BaseModel):
    """Telegram user data model"""
    model_config = ConfigDict(from_attributes=True)

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
    """User profile response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    profile: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: int = Field(..., description="User ID (subject)")
    exp: int = Field(..., description="Expiration timestamp")
    iat: int = Field(..., description="Issued at timestamp")
    type: str = Field(default="access", description="Token type")


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str = Field(..., description="Refresh token")


class LogoutResponse(BaseModel):
    """Logout response"""
    message: str = "Successfully logged out"
