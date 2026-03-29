from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.security import create_access_token, create_refresh_token, verify_token
from app.domain.user import User
from app.domain.exceptions import AuthenticationError
from app.infrastructure.repositories.auth_repository import AuthRepository
from app.schemas.auth import (
    AuthResponse,
    LogoutResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TelegramAuthRequest,
    TelegramUserData,
    UserProfileResponse,
    UserProfileUpdate,
    user_profile_from_db,
)
from app.settings import settings
from app.infrastructure.telegram_auth import validate_and_get_user


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = AuthRepository(db)

    async def _get_or_create_user(self, telegram_user_data: dict) -> User:
        telegram_id = telegram_user_data["id"]
        user = await self.repository.get_user_by_telegram_id(telegram_id=telegram_id)
        if user is None:
            user = User(
                telegram_id=telegram_id,
                username=telegram_user_data.get("username"),
                first_name=telegram_user_data.get("first_name"),
                profile={"equipment": [], "limitations": [], "goals": []},
                settings={"theme": "telegram", "notifications": True, "units": "metric"},
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return user

        user.username = telegram_user_data.get("username") or user.username
        user.first_name = telegram_user_data.get("first_name") or user.first_name
        await self.db.commit()
        return user

    async def authenticate_telegram(self, auth_request: TelegramAuthRequest) -> AuthResponse:
        is_valid, user_data, error = validate_and_get_user(
            init_data=auth_request.init_data,
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            max_age_seconds=300,
        )
        if not is_valid:
            raise AuthenticationError(f"Authentication failed: {error}")

        user = await self._get_or_create_user(user_data)
        access_token = create_access_token(user.telegram_id)
        create_refresh_token(user.telegram_id)  # preserved side-effect compatibility

        user_response = TelegramUserData(
            id=user_data["id"],
            username=user_data.get("username"),
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name"),
            language_code=user_data.get("language_code"),
            is_premium=user_data.get("is_premium"),
            photo_url=user_data.get("photo_url"),
            allows_write_to_pm=user_data.get("allows_write_to_pm"),
        )
        return AuthResponse(
            success=True,
            message="Authentication successful",
            user=user_response,
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def update_profile(
        self, current_user: User, profile_update: UserProfileUpdate
    ) -> UserProfileResponse:
        update_data = profile_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field in ["profile", "settings"] and value is not None:
                current_value = dict(getattr(current_user, field, {}) or {})
                current_value.update(value)
                setattr(current_user, field, current_value)
                flag_modified(current_user, field)
            else:
                setattr(current_user, field, value)
        await self.db.commit()
        await self.db.refresh(current_user)
        return user_profile_from_db(current_user)

    @staticmethod
    def refresh_token(refresh_request: RefreshTokenRequest) -> RefreshTokenResponse:
        user_id = verify_token(refresh_request.refresh_token, token_type="refresh")
        if user_id is None:
            raise AuthenticationError("Invalid or expired refresh token")
        return RefreshTokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def logout() -> LogoutResponse:
        return LogoutResponse()
