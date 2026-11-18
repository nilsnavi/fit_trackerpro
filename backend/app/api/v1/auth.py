"""
Telegram WebApp authentication: public login/refresh vs JWT-protected session routes.

Public: ``POST /telegram``, ``POST /register`` (same handler as telegram), ``POST /lookup``
(initData validation + existence check), ``POST /refresh`` (no Bearer required).
Protected: profile under ``/me``, ``POST /logout`` (Bearer access token).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.auth_service import AuthService
from app.application.email_auth_service import EmailAuthError, EmailAuthService
from app.core.audit import get_client_ip
from app.core.limiter import limiter
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.auth import (
    AuthResponse,
    LogoutRequest,
    LogoutResponse,
    OnboardingRequest,
    OnboardingResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TelegramAuthRequest,
    TelegramLookupResponse,
    UserProfileResponse,
    UserProfileUpdate,
)
from app.schemas.email_auth import EmailChallengeResponse, EmailCodeRequest, EmailCodeVerify

# Login and token refresh — no Authorization header.
public_auth_router = APIRouter()

# Session-bound routes — Bearer access token (see ``ROUTER_DEPENDENCIES_AUTHENTICATED`` in registration).
protected_auth_router = APIRouter()


@public_auth_router.post("/telegram", response_model=AuthResponse)
@limiter.limit("10/minute")
async def authenticate_telegram(
    request: Request,
    auth_request: TelegramAuthRequest,
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    return await service.authenticate_telegram(
        auth_request=auth_request,
        client_ip=get_client_ip(request),
    )


@public_auth_router.post("/lookup", response_model=TelegramLookupResponse)
@limiter.limit("30/minute")
async def lookup_telegram_registration(
    request: Request,
    auth_request: TelegramAuthRequest,
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    return await service.lookup_telegram_registration(auth_request=auth_request)


@public_auth_router.post("/register", response_model=AuthResponse)
@limiter.limit("10/minute")
async def register_via_telegram(
    request: Request,
    auth_request: TelegramAuthRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """First-time registration: validates initData and returns JWT (same as POST /telegram)."""
    service = AuthService(db)
    return await service.authenticate_telegram(
        auth_request=auth_request,
        client_ip=get_client_ip(request),
    )


@public_auth_router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
):
    return await AuthService(db).refresh_token(
        refresh_request=refresh_request,
        client_ip=get_client_ip(request),
    )


@protected_auth_router.get("/me", response_model=UserProfileResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return AuthService.get_profile(current_user)


@protected_auth_router.put("/me", response_model=UserProfileResponse)
async def update_user_profile(
    profile_update: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    return await service.update_profile(
        current_user=current_user,
        profile_update=profile_update,
        client_ip=get_client_ip(request),
    )


@protected_auth_router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await AuthService(db).logout(
        current_user=current_user,
        client_ip=get_client_ip(request),
        refresh_token=payload.refresh_token if payload else None,
    )


@protected_auth_router.post("/onboarding", response_model=OnboardingResponse)
async def save_onboarding(
    onboarding_request: OnboardingRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AuthService(db)
    return await service.save_onboarding(
        current_user=current_user,
        payload=onboarding_request,
        client_ip=get_client_ip(request),
    )


@public_auth_router.post("/email/request", response_model=EmailChallengeResponse)
@limiter.limit("5/minute")
async def request_email_login(
    request: Request, payload: EmailCodeRequest, db: AsyncSession = Depends(get_async_db),
):
    try:
        return EmailChallengeResponse(challenge_id=await EmailAuthService(db).request_code(payload.email))
    except EmailAuthError as error:
        raise HTTPException(error.status, error.detail) from None


@public_auth_router.post("/email/verify", response_model=RefreshTokenResponse)
@limiter.limit("20/minute")
async def verify_email_login(
    request: Request, payload: EmailCodeVerify, db: AsyncSession = Depends(get_async_db),
):
    try:
        user = await EmailAuthService(db).verify(payload)
    except EmailAuthError as error:
        raise HTTPException(error.status, error.detail) from None
    return await AuthService(db).issue_email_session(user, client_ip=get_client_ip(request))


@protected_auth_router.post("/email/link/request", response_model=EmailChallengeResponse)
@limiter.limit("5/minute")
async def request_email_link(
    request: Request, payload: EmailCodeRequest, user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    if user.email is not None:
        raise HTTPException(409, "К аккаунту уже привязан email.")
    try:
        return EmailChallengeResponse(
            challenge_id=await EmailAuthService(db).request_code(payload.email, user_id=user.id)
        )
    except EmailAuthError as error:
        raise HTTPException(error.status, error.detail) from None


@protected_auth_router.post("/email/link/verify", status_code=204, response_class=Response)
@limiter.limit("20/minute")
async def verify_email_link(
    request: Request, payload: EmailCodeVerify, user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        await EmailAuthService(db).verify(payload, user_id=user.id)
    except EmailAuthError as error:
        raise HTTPException(error.status, error.detail) from None
    return Response(status_code=204)
