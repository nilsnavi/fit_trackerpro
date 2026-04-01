"""
Auth Schemas
Pydantic models for authentication endpoints
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import TokenKind, UserTheme, UserUnits

# --- Response / stored profile (permissive; must accept legacy DB JSON) ---


class UserProfileData(BaseModel):
    """User profile JSON (equipment, limitations, goals)."""

    model_config = ConfigDict(extra="allow")

    equipment: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    goals: List[str] = Field(default_factory=list)
    current_weight: Optional[float] = Field(
        None,
        gt=0,
        le=1000,
        description="Current body weight in kilograms.",
    )
    target_weight: Optional[float] = Field(
        None,
        gt=0,
        le=1000,
        description="Target body weight in kilograms.",
    )
    height: Optional[float] = Field(
        None,
        gt=0,
        le=300,
        description="Height in centimeters.",
    )
    birth_date: Optional[str] = Field(
        None,
        min_length=4,
        max_length=32,
        description="Date of birth (string; format depends on client).",
    )


class UserSettingsData(BaseModel):
    """User settings JSON (theme, notifications, units)."""

    model_config = ConfigDict(extra="allow")

    theme: str = "telegram"
    notifications: bool = True
    units: str = "metric"


# --- Strict request bodies for PATCH / profile update ---

_ShortLabel = Annotated[
    str,
    Field(
        min_length=1,
        max_length=128,
        description="Non-empty label up to 128 characters.",
    ),
]


class UserProfilePatch(BaseModel):
    """Validated subset of profile JSON for updates (merged server-side)."""

    model_config = ConfigDict(extra="allow")

    equipment: Optional[List[_ShortLabel]] = Field(
        None,
        max_length=50,
        description="At most 50 equipment tags.",
    )
    limitations: Optional[List[_ShortLabel]] = Field(
        None,
        max_length=50,
        description="At most 50 limitation tags.",
    )
    goals: Optional[List[_ShortLabel]] = Field(
        None,
        max_length=50,
        description="At most 50 goal tags.",
    )
    current_weight: Optional[float] = Field(
        None,
        gt=0,
        le=1000,
        description="Current body weight in kilograms.",
    )
    target_weight: Optional[float] = Field(
        None,
        gt=0,
        le=1000,
        description="Target body weight in kilograms.",
    )
    height: Optional[float] = Field(
        None,
        gt=0,
        le=300,
        description="Height in centimeters.",
    )
    birth_date: Optional[str] = Field(
        None,
        min_length=4,
        max_length=32,
        description="Date of birth (string; format depends on client).",
    )


class UserSettingsPatch(BaseModel):
    """Validated settings for partial updates."""

    theme: Optional[UserTheme] = Field(
        None,
        description="UI theme preset.",
    )
    notifications: Optional[bool] = Field(
        None,
        description="Enable push / in-app notifications.",
    )
    units: Optional[UserUnits] = Field(
        None,
        description="Measurement system for weights and distances.",
    )


class TelegramAuthRequest(BaseModel):
    """Request model for Telegram authentication"""

    init_data: str = Field(
        ...,
        min_length=1,
        max_length=16384,
        description="Raw initData string from Telegram WebApp",
        examples=["query_id=...&user={...}&auth_date=...&hash=..."],
    )


class TelegramUserData(BaseModel):
    """Telegram user data model"""

    id: int = Field(..., gt=0, le=10**12, description="Telegram user ID")
    username: Optional[str] = Field(
        None,
        max_length=64,
        description="Username",
    )
    first_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="First name",
    )
    last_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Last name",
    )
    language_code: Optional[str] = Field(
        None,
        min_length=2,
        max_length=16,
        description="BCP 47 language tag (e.g. en, ru).",
    )
    is_premium: Optional[bool] = Field(
        None, description="Is Telegram Premium user")
    photo_url: Optional[str] = Field(
        None,
        max_length=2048,
        description="Profile photo URL",
    )
    allows_write_to_pm: Optional[bool] = Field(
        None, description="Allows writing to PM")


class AuthResponse(BaseModel):
    """Authentication response"""
    success: bool
    message: str = Field(..., max_length=2000)
    user: Optional[TelegramUserData] = None
    access_token: Optional[str] = Field(None, max_length=16384)
    refresh_token: Optional[str] = Field(
        None,
        min_length=32,
        max_length=16384,
        description="Refresh token; optional for backward compatibility.",
    )
    token_type: str = Field(default="bearer", pattern="^(?i)bearer$")
    expires_in: Optional[int] = Field(
        None,
        ge=0,
        le=86400 * 365,
        description="Token expiration in seconds",
    )


class UserProfileUpdate(BaseModel):
    """Request model for updating user profile"""
    first_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Given name; omit to leave unchanged.",
    )
    last_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Family name; omit to leave unchanged.",
    )
    profile: Optional[UserProfilePatch] = Field(
        None,
        description="User profile data: equipment, limitations, goals",
    )
    settings: Optional[UserSettingsPatch] = Field(
        None,
        description="User settings: theme, notifications, units",
    )


class UserProfileResponse(BaseModel):
    """User profile response (API contract; not an ORM model)."""

    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    profile: UserProfileData = Field(default_factory=UserProfileData)
    settings: UserSettingsData = Field(default_factory=UserSettingsData)
    created_at: datetime
    updated_at: datetime


def user_profile_from_db(user) -> UserProfileResponse:
    """Map persisted user row to API DTO (no ORM in route handlers)."""
    return UserProfileResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        profile=UserProfileData.model_validate(user.profile or {}),
        settings=UserSettingsData.model_validate(user.settings or {}),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: int = Field(..., gt=0, description="User ID (subject)")
    exp: int = Field(..., ge=0, description="Expiration timestamp")
    iat: int = Field(..., ge=0, description="Issued at timestamp")
    type: TokenKind = Field(
        default=TokenKind.ACCESS,
        description="Token type",
    )


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str = Field(
        ...,
        min_length=32,
        max_length=16384,
        description="Opaque refresh token issued by this API.",
    )


class RefreshTokenResponse(BaseModel):
    """Token refresh response"""
    access_token: str = Field(..., min_length=10, max_length=16384)
    refresh_token: str = Field(..., min_length=32, max_length=16384)
    token_type: str = Field(default="bearer", pattern="^(?i)bearer$")
    expires_in: int = Field(
        ...,
        ge=60,
        le=86400 * 365,
        description="Access token lifetime in seconds",
    )


class LogoutResponse(BaseModel):
    """Logout response"""
    message: str = Field(default="Successfully logged out", max_length=500)
