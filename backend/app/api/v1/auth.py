"""
Telegram WebApp authentication: public login/refresh vs JWT-protected session routes.

Public: ``POST /telegram``, ``POST /register`` (same handler as telegram), ``POST /lookup``
(initData validation + existence check), ``POST /refresh`` (no Bearer required).
Protected: profile under ``/me``, ``POST /logout`` (Bearer access token).
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.auth_service import AuthService
from app.core.limiter import limiter
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.auth import (
    AuthResponse,
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
async def refresh_token(refresh_request: RefreshTokenRequest, request: Request):
    return AuthService.refresh_token(
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
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    return AuthService.logout(current_user=current_user, client_ip=get_client_ip(request))


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
