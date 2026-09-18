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
from app.domain.exceptions import (
    ProgressionRecommendationNotFoundError,
    ProgressionValidationError,
)
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.progression import (
    ProgressionBulkResult,
    ProgressionPolicyResponse,
    ProgressionPolicyUpdate,
    ProgressionPrefillBulkDisable,
    ProgressionPrefillListResponse,
    ProgressionRecommendationDecision,
    ProgressionRecommendationResponse,
    ProgressionTargetBulkUpdate,
    ProgressionTargetUpdate,
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


@router.get(
    "/prefill",
    response_model=ProgressionPrefillListResponse,
    summary="Accepted targets and their automatic-prefill state",
)
async def list_prefill_targets(
    declined_only: bool = Query(
        False, description="Only targets whose automatic prefill the user switched off."
    ),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """SPEC §58: the newest accepted target per scope, prefill state included."""
    service = ProgressionEngineService(db)
    items = await service.list_prefill_targets(
        user_id=current_user.id,
        declined_only=declined_only,
        limit=limit,
    )
    return {"items": items, "total": len(items)}


@router.post(
    "/prefill/bulk-disable",
    response_model=ProgressionBulkResult,
    summary="Stop prefilling many accepted targets automatically",
)
async def bulk_disable_prefill(
    payload: Optional[ProgressionPrefillBulkDisable] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """SPEC §58: omitting the ids switches off every target the screen lists.

    One tap after a training cycle instead of walking the list row by row. The
    targets themselves are untouched — only the silent substitution stops.
    """
    service = ProgressionEngineService(db)
    return await service.disable_prefill_bulk(
        user_id=current_user.id,
        recommendation_ids=payload.recommendation_ids if payload is not None else None,
    )


@router.post(
    "/prefill/bulk-update",
    response_model=ProgressionBulkResult,
    summary="Apply one policy / rep-range edit to many accepted targets",
)
async def bulk_update_prefill_targets(
    payload: ProgressionTargetBulkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """SPEC §58: values and prefill switches stay per-target; only the plan moves."""
    if payload.type is None and payload.reps_min is None and payload.reps_max is None:
        raise ProgressionValidationError("Nothing to apply to the selected targets")
    service = ProgressionEngineService(db)
    return await service.update_targets_bulk(
        user_id=current_user.id,
        recommendation_ids=payload.recommendation_ids,
        policy_type=payload.type,
        reps_min=payload.reps_min,
        reps_max=payload.reps_max,
    )


@router.patch(
    "/prefill/{recommendation_id}",
    response_model=ProgressionRecommendationResponse,
    summary="Edit an accepted target's value, policy and rep range",
)
async def update_prefill_target(
    recommendation_id: int,
    payload: ProgressionTargetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Only fields the user actually edited are written (SPEC §58)."""
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise ProgressionValidationError("Nothing to update on this target")
    service = ProgressionEngineService(db)
    found, result = await service.update_target(
        user_id=current_user.id,
        recommendation_id=recommendation_id,
        value=data.get("value"),
        policy_type=data.get("type"),
        reps_min=data.get("reps_min"),
        reps_max=data.get("reps_max"),
    )
    if not found:
        raise ProgressionRecommendationNotFoundError("Recommendation not found")
    return result


@router.post(
    "/prefill/{recommendation_id}/enable",
    response_model=ProgressionRecommendationResponse,
    summary="Turn the automatic prefill of an accepted target back on",
)
async def enable_prefill(
    recommendation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """The target itself is unchanged — only the silent substitution returns."""
    service = ProgressionEngineService(db)
    found, result = await service.enable_prefill(
        user_id=current_user.id,
        recommendation_id=recommendation_id,
    )
    if not found:
        raise ProgressionRecommendationNotFoundError("Recommendation not found")
    return result


@router.post(
    "/prefill/{recommendation_id}/disable",
    response_model=ProgressionRecommendationResponse,
    summary="Stop prefilling an accepted target automatically",
)
async def disable_prefill(
    recommendation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Same as undoing the prefill in a session: the target itself is kept (SPEC §58)."""
    service = ProgressionEngineService(db)
    found, result = await service.disable_prefill(
        user_id=current_user.id,
        recommendation_id=recommendation_id,
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
