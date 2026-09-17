"""Progression API (SPEC-006 §41).

HTTP-only: every handler delegates to ``ProgressionEngineService``. Routes keep
the project's existing conventions (``/api/v1/<domain>/...``, Bearer auth via
the router mount, domain errors mapped by the global handlers).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.progression_engine_service import ProgressionEngineService
from app.domain.exceptions import ProgressionRecommendationNotFoundError
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.progression import (
    ProgressionPolicyResponse,
    ProgressionPolicyUpdate,
    ProgressionRecommendationDecision,
    ProgressionRecommendationResponse,
)

router = APIRouter()


@router.get(
    "/exercises/{exercise_id}",
    response_model=ProgressionPolicyResponse,
    summary="Effective progression policy for an exercise scope",
)
async def get_exercise_progression(
    exercise_id: int,
    template_id: Optional[int] = Query(None, ge=1),
    template_exercise_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Progression scope is user + program/template + exercise + exercise slot (SPEC §7)."""
    service = ProgressionEngineService(db)
    return await service.get_policy_view(
        user_id=current_user.id,
        exercise_id=exercise_id,
        template_id=template_id,
        template_exercise_id=template_exercise_id,
    )


@router.put(
    "/exercises/{exercise_id}",
    response_model=ProgressionPolicyResponse,
    summary="Configure progression for an exercise scope",
)
async def update_exercise_progression(
    exercise_id: int,
    payload: ProgressionPolicyUpdate,
    template_id: Optional[int] = Query(None, ge=1),
    template_exercise_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Persisting a policy never changes existing recommendations or workout history."""
    service = ProgressionEngineService(db)
    return await service.upsert_policy(
        user_id=current_user.id,
        exercise_id=exercise_id,
        template_id=template_id,
        template_exercise_id=template_exercise_id,
        data=payload.model_dump(exclude_unset=True),
    )


@router.get(
    "/exercises/{exercise_id}/recommendation",
    response_model=ProgressionRecommendationResponse,
    summary="Latest persisted recommendation (or a read-only preview)",
)
async def get_exercise_recommendation(
    exercise_id: int,
    template_id: Optional[int] = Query(None, ge=1),
    template_exercise_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ProgressionEngineService(db)
    result = await service.get_recommendation_view(
        user_id=current_user.id,
        exercise_id=exercise_id,
        template_id=template_id,
        template_exercise_id=template_exercise_id,
    )
    if result is None:
        raise ProgressionRecommendationNotFoundError(
            "No progression recommendation available for this exercise yet"
        )
    return result


@router.get(
    "/exercises/{exercise_id}/history",
    response_model=list[ProgressionRecommendationResponse],
    summary="Recommendation history for an exercise scope",
)
async def get_exercise_progression_history(
    exercise_id: int,
    template_id: Optional[int] = Query(None, ge=1),
    template_exercise_id: Optional[int] = Query(None, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ProgressionEngineService(db)
    return await service.list_history(
        user_id=current_user.id,
        exercise_id=exercise_id,
        template_id=template_id,
        template_exercise_id=template_exercise_id,
        limit=limit,
    )


@router.post(
    "/recommendations/{recommendation_id}/accept",
    response_model=ProgressionRecommendationResponse,
    summary="Accept (or modify) a recommendation",
)
async def accept_recommendation(
    recommendation_id: int,
    payload: Optional[ProgressionRecommendationDecision] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Only an explicit accept may change the program target (SPEC §42/§43)."""
    service = ProgressionEngineService(db)
    selected = payload.selected_value if payload is not None else None
    found, result = await service.accept_recommendation(
        user_id=current_user.id,
        recommendation_id=recommendation_id,
        selected_value=selected,
    )
    if not found:
        raise ProgressionRecommendationNotFoundError("Recommendation not found")
    return result


@router.post(
    "/recommendations/{recommendation_id}/reject",
    response_model=ProgressionRecommendationResponse,
    summary="Reject a recommendation",
)
async def reject_recommendation(
    recommendation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Rejection leaves workout history untouched (SPEC §44)."""
    service = ProgressionEngineService(db)
    found, result = await service.reject_recommendation(
        user_id=current_user.id,
        recommendation_id=recommendation_id,
    )
    if not found:
        raise ProgressionRecommendationNotFoundError("Recommendation not found")
    return result
