"""Client-controlled, explicit opt-in and revoke; no Coach-facing grant writes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.client_grant_service import ClientGrantService
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.coach_grants import AvailableCoach, GrantCreate, GrantHistory, GrantView

router = APIRouter()


@router.get("/available-coaches", response_model=list[AvailableCoach])
async def available_coaches_for_client(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await ClientGrantService(db).available_coaches(current_user.id)


@router.get("", response_model=list[GrantView])
async def list_my_grants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await ClientGrantService(db).list_owned(current_user.id)


@router.post("", response_model=GrantView, status_code=status.HTTP_201_CREATED)
async def create_my_grant(
    payload: GrantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await ClientGrantService(db).grant(current_user.id, payload)


@router.get("/{grant_id}/history", response_model=GrantHistory)
async def get_my_grant_history(
    grant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await ClientGrantService(db).history(current_user.id, grant_id)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_my_grant(
    grant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    await ClientGrantService(db).revoke(current_user.id, grant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
