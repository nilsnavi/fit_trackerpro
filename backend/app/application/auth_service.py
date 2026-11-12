from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
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
from app.core.legal import HEALTH_DATA_CONSENT_VERSION
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    refresh_token_expires_at,
)
from app.domain.exceptions import AuthenticationError, ConsentRequiredError
from app.domain.refresh_session import RefreshSession
from app.domain.user import User
from app.infrastructure.repositories.auth_repository import AuthRepository
from app.infrastructure.repositories.refresh_session_repository import (
    RefreshSessionRepository,
)
from app.infrastructure.telegram_auth import validate_and_get_user
from app.schemas.auth import (
    AuthResponse,
    LogoutResponse,
    OnboardingRequest,
    OnboardingResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TelegramAuthRequest,
    TelegramLookupResponse,
    TelegramUserData,
    UserProfileData,
    UserProfileResponse,
    UserProfileUpdate,
    user_profile_from_db,
)
from app.settings import settings


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = AuthRepository(db)
        self.sessions = RefreshSessionRepository(db)

    @staticmethod
    def get_profile(user: User) -> UserProfileResponse:
        return user_profile_from_db(user)

    async def _issue_refresh_session(
        self,
        user: User,
        *,
        client_ip: str | None = None,
        user_agent: str | None = None,
        family_id: str | None = None,
    ) -> tuple[str, str]:
        """Issue a rotating refresh token and persist its hashed session row."""
        jti = uuid4().hex
        family = family_id or uuid4().hex
        token = create_refresh_token(
            user.telegram_id,
            user.token_generation,
            jti=jti,
            family_id=family,
        )
        await self.sessions.create(
            RefreshSession(
                user_id=user.id,
                jti=jti,
                token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
                family_id=family,
                expires_at=refresh_token_expires_at(),
                user_agent=user_agent,
                ip=client_ip,
            )
        )
        return token, jti

    async def delete_account(self, user: User, client_ip: str | None = None) -> None:
        uid = user.id
        tg = user.telegram_id
        # Revoke every refresh session (FK cascade also removes rows on delete).
        await self.sessions.revoke_all_for_user(uid)
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
            try:
                return await self.repository.insert_user(user), True
            except IntegrityError:
                await self.repository.rollback()
                existing = await self.repository.get_user_by_telegram_id(telegram_id=telegram_id)
                if existing is None:
                    raise
                return existing, False

        user.username = telegram_user_data.get("username") or user.username
        user.first_name = telegram_user_data.get("first_name") or user.first_name
        profile_data = dict(user.profile or {})
        if telegram_user_data.get("photo_url"):
            profile_data["telegram_photo_url"] = telegram_user_data.get("photo_url")
            user.profile = profile_data
        await self.repository.commit_user_fields()
        return user, False

    async def lookup_telegram_registration(
        self,
        auth_request: TelegramAuthRequest,
    ) -> TelegramLookupResponse:
        """Validate initData and report whether a user already exists (does not create a row)."""
        is_valid, user_data, error = validate_and_get_user(
            init_data=auth_request.init_data,
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            max_age_seconds=settings.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
        )
        if not is_valid:
            raise AuthenticationError(f"Authentication failed: {error}")

        telegram_id = user_data["id"]
        user = await self.repository.get_user_by_telegram_id(telegram_id=telegram_id)
        return TelegramLookupResponse(registered=user is not None)

    async def authenticate_telegram(
        self,
        auth_request: TelegramAuthRequest,
        client_ip: str | None = None,
    ) -> AuthResponse:
        is_valid, user_data, error = validate_and_get_user(
            init_data=auth_request.init_data,
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            max_age_seconds=settings.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
        )
        if not is_valid:
            raise AuthenticationError(f"Authentication failed: {error}")

        user, created = await self._get_or_create_user(user_data)
        access_token = create_access_token(user.telegram_id)
        refresh_token, _ = await self._issue_refresh_session(user, client_ip=client_ip)
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
        consent = profile.get("consent")
        if not isinstance(consent, dict) or not consent.get("version"):
            consent = None

        if not payload.health_data_consent and consent is None:
            raise ConsentRequiredError(
                "Требуется согласие на обработку данных о здоровье: "
                "без него приложение не может хранить пульс, глюкозу, вес и сон"
            )

        profile["fitness_goal"] = payload.fitness_goal
        profile["experience_level"] = payload.experience_level
        if consent is None:
            # Record exactly the version the user accepted; never rewrite the
            # original timestamp on a repeated onboarding call.
            profile["consent"] = {
                "version": (payload.consent_version or "").strip()
                or HEALTH_DATA_CONSENT_VERSION,
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "source": "onboarding",
            }
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
                "consent_version": (profile.get("consent") or {}).get("version"),
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

    async def refresh_token(
        self,
        refresh_request: RefreshTokenRequest,
        client_ip: str | None = None,
    ) -> RefreshTokenResponse:
        payload = decode_refresh_token(refresh_request.refresh_token)
        if not payload:
            raise AuthenticationError("Invalid or expired refresh token")

        try:
            user_id = int(payload.get("sub"))
        except (TypeError, ValueError):
            raise AuthenticationError("Invalid or expired refresh token") from None

        jti = payload.get("jti")
        family_id = payload.get("family_id")
        generation = payload.get("generation")
        if not isinstance(jti, str) or not isinstance(family_id, str) or generation is None:
            raise AuthenticationError("Invalid or expired refresh token")

        user = await self.repository.get_user_by_telegram_id(telegram_id=user_id)
        if user is None or generation != str(user.token_generation):
            raise AuthenticationError("Invalid or expired refresh token")

        session = await self.sessions.get_by_jti(jti)
        if session is None:
            raise AuthenticationError("Invalid or expired refresh token")

        token_hash = hashlib.sha256(
            refresh_request.refresh_token.encode("utf-8")
        ).hexdigest()
        if session.user_id != user.id or session.token_hash != token_hash:
            # Tampered or already-rotated token: burn the whole family.
            await self.sessions.revoke_family(user.id, session.family_id)
            raise AuthenticationError("Invalid or expired refresh token")

        now = datetime.now(timezone.utc)
        if session.revoked_at is not None:
            # Reuse of a burned token — likely token theft: revoke the family.
            await self.sessions.revoke_family(user.id, session.family_id)
            audit_log(
                action=AUTH_REFRESH,
                user_db_id=user.id,
                telegram_id=user.telegram_id,
                client_ip=client_ip,
                meta={"reused_refresh_token": True, "family_id": session.family_id},
            )
            raise AuthenticationError("Refresh token has been revoked")

        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            await self.sessions.revoke(session)
            raise AuthenticationError("Invalid or expired refresh token")

        # Rotation: issue a new token in the same family, revoke the used one.
        new_token, new_jti = await self._issue_refresh_session(
            user,
            client_ip=client_ip,
            family_id=session.family_id,
        )
        await self.sessions.revoke(session, replaced_by_jti=new_jti)
        await self.sessions.delete_expired(now=now)

        audit_log(
            action=AUTH_REFRESH,
            user_db_id=user.id,
            telegram_id=user.telegram_id,
            client_ip=client_ip,
        )
        return RefreshTokenResponse(
            access_token=create_access_token(user.telegram_id),
            refresh_token=new_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(
        self,
        current_user: User,
        client_ip: str | None = None,
        refresh_token: str | None = None,
    ) -> LogoutResponse:
        """Revoke the supplied refresh session, or every session when omitted."""
        revoked = 0
        if refresh_token:
            payload = decode_refresh_token(refresh_token)
            jti = payload.get("jti") if payload else None
            if isinstance(jti, str):
                session = await self.sessions.get_by_jti(jti)
                if (
                    session is not None
                    and session.user_id == current_user.id
                    and session.revoked_at is None
                ):
                    await self.sessions.revoke(session)
                    revoked = 1
        if revoked == 0:
            revoked = await self.sessions.revoke_all_for_user(current_user.id)

        audit_log(
            action=AUTH_LOGOUT,
            user_db_id=current_user.id,
            telegram_id=current_user.telegram_id,
            client_ip=client_ip,
            meta={"revoked_sessions": revoked},
        )
        return LogoutResponse()
