from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.audit import (
    AUTH_ACCOUNT_DELETE,
    AUTH_LOGOUT,
    AUTH_ONBOARDING_UPDATE,
    AUTH_PROFILE_UPDATE,
    AUTH_REFRESH,
    AUTH_TELEGRAM_LOGIN,
    audit_log,
)
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.domain.exceptions import AuthenticationError
from app.domain.user import User
from app.infrastructure.repositories.auth_repository import AuthRepository
from app.infrastructure.telegram_auth import validate_and_get_user
from app.schemas.auth import (
    AuthResponse,
    LogoutResponse,
    OnboardingRequest,
    OnboardingResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TelegramAuthRequest,
    TelegramUserData,
    UserProfileResponse,
    UserProfileUpdate,
    UserProfileData,
    user_profile_from_db,
)
from app.settings import settings


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = AuthRepository(db)

    @staticmethod
    def get_profile(user: User) -> UserProfileResponse:
        return user_profile_from_db(user)

    async def delete_account(self, user: User, client_ip: str | None = None) -> None:
        uid = user.id
        tg = user.telegram_id
        await self.repository.delete_user(user)
        audit_log(
            action=AUTH_ACCOUNT_DELETE,
            user_db_id=uid,
            telegram_id=tg,
            client_ip=client_ip,
        )

    async def _get_or_create_user(self, telegram_user_data: dict) -> tuple[User, bool]:
        telegram_id = telegram_user_data["id"]
        user = await self.repository.get_user_by_telegram_id(telegram_id=telegram_id)
        if user is None:
            telegram_photo_url = telegram_user_data.get("photo_url")
            user = User(
                telegram_id=telegram_id,
                username=telegram_user_data.get("username"),
                first_name=telegram_user_data.get("first_name"),
                profile={
                    "equipment": [],
                    "limitations": [],
                    "goals": [],
                    "telegram_photo_url": telegram_photo_url,
                    "onboarding_completed": False,
                },
                settings={"theme": "telegram", "notifications": True, "units": "metric"},
            )
            return await self.repository.insert_user(user), True

        user.username = telegram_user_data.get("username") or user.username
        user.first_name = telegram_user_data.get("first_name") or user.first_name
        profile_data = dict(user.profile or {})
        if telegram_user_data.get("photo_url"):
            profile_data["telegram_photo_url"] = telegram_user_data.get("photo_url")
            user.profile = profile_data
        await self.repository.commit_user_fields()
        return user, False

    async def authenticate_telegram(
        self,
        auth_request: TelegramAuthRequest,
        client_ip: str | None = None,
    ) -> AuthResponse:
        is_valid, user_data, error = validate_and_get_user(
            init_data=auth_request.init_data,
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            max_age_seconds=300,
        )
        if not is_valid:
            raise AuthenticationError(f"Authentication failed: {error}")

        user, created = await self._get_or_create_user(user_data)
        access_token = create_access_token(user.telegram_id)
        refresh_token = create_refresh_token(user.telegram_id)
        onboarding_required = bool(created or not (user.profile or {}).get("onboarding_completed", False))

        audit_log(
            action=AUTH_TELEGRAM_LOGIN,
            user_db_id=user.id,
            telegram_id=user.telegram_id,
            client_ip=client_ip,
            meta={"is_new_user": created},
        )

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
            refresh_token=refresh_token,
            is_new_user=created,
            onboarding_required=onboarding_required,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def save_onboarding(
        self,
        current_user: User,
        payload: OnboardingRequest,
        client_ip: str | None = None,
    ) -> OnboardingResponse:
        profile = dict(current_user.profile or {})
        profile["fitness_goal"] = payload.fitness_goal
        profile["experience_level"] = payload.experience_level
        profile["onboarding_completed"] = True
        profile["onboarding_completed_at"] = datetime.now(timezone.utc).isoformat()
        current_user.profile = profile

        await self.repository.save_profile(current_user)

        audit_log(
            action=AUTH_ONBOARDING_UPDATE,
            user_db_id=current_user.id,
            telegram_id=current_user.telegram_id,
            client_ip=client_ip,
            meta={
                "fitness_goal": payload.fitness_goal,
                "experience_level": payload.experience_level,
            },
        )

        return OnboardingResponse(
            success=True,
            message="Onboarding saved",
            profile=UserProfileData.model_validate(current_user.profile or {}),
        )

    async def update_profile(
        self,
        current_user: User,
        profile_update: UserProfileUpdate,
        client_ip: str | None = None,
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
        await self.repository.save_profile(current_user)
        audit_log(
            action=AUTH_PROFILE_UPDATE,
            user_db_id=current_user.id,
            telegram_id=current_user.telegram_id,
            client_ip=client_ip,
            meta={"fields": sorted(update_data.keys())},
        )
        return user_profile_from_db(current_user)

    @staticmethod
    def refresh_token(
        refresh_request: RefreshTokenRequest,
        client_ip: str | None = None,
    ) -> RefreshTokenResponse:
        user_id = verify_token(refresh_request.refresh_token, token_type="refresh")
        if user_id is None:
            raise AuthenticationError("Invalid or expired refresh token")
        audit_log(
            action=AUTH_REFRESH,
            telegram_id=user_id,
            client_ip=client_ip,
        )
        return RefreshTokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def logout(current_user: User, client_ip: str | None = None) -> LogoutResponse:
        audit_log(
            action=AUTH_LOGOUT,
            user_db_id=current_user.id,
            telegram_id=current_user.telegram_id,
            client_ip=client_ip,
        )
        return LogoutResponse()
