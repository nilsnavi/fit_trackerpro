"""
Challenges API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain import User, get_async_db
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeDetailResponse,
    ChallengeJoinResponse,
    ChallengeListResponse,
    ChallengeResponse,
)
from app.services.challenges_service import (
    ChallengeForbiddenError,
    ChallengeNotFoundError,
    ChallengesService,
    ChallengeValidationError,
)

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ChallengeNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ChallengeValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, ChallengeForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected challenges error")


@router.get("/", response_model=ChallengeListResponse)
async def get_challenges(
    status: Optional[str] = Query(None, pattern="^(upcoming|active|completed|cancelled)$"),
    challenge_type: Optional[str] = Query(None, pattern="^(workout_count|duration|calories|distance|custom)$"),
    is_public: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.get_challenges(
            status=status,
            challenge_type=challenge_type,
            is_public=is_public,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/my/active")
async def get_my_active_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.get_my_active_challenges()
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/{challenge_id}", response_model=ChallengeDetailResponse)
async def get_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.get_challenge(challenge_id=challenge_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    challenge_data: ChallengeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.create_challenge(
            user_id=current_user.id,
            user_first_name=current_user.first_name,
            data=challenge_data,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/{challenge_id}/join", response_model=ChallengeJoinResponse)
async def join_challenge(
    challenge_id: int,
    join_code: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.join_challenge(challenge_id=challenge_id, join_code=join_code)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/{challenge_id}/leave")
async def leave_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.leave_challenge(challenge_id=challenge_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/{challenge_id}/leaderboard")
async def get_challenge_leaderboard(
    challenge_id: int,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ChallengesService(db)
    try:
        return await service.get_challenge_leaderboard(challenge_id=challenge_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc
