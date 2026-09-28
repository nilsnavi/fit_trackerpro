from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.coach import require_coach, require_coach_feature
from app.application.coach_service import (
    CoachIdentityService,
    CoachInvitationService,
    CoachRelationshipService,
)
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.coach import (
    CoachClientDetailResponse,
    CoachClientResponse,
    CoachClientUpdate,
    CoachInvitationAccept,
    CoachInvitationCreate,
    CoachInvitationCreatedResponse,
    CoachInvitationResolveResponse,
    CoachInvitationResponse,
    CoachProfileCreate,
    CoachProfileResponse,
    CoachProfileUpdate,
)

router = APIRouter(dependencies=[Depends(require_coach_feature)])


@router.post("/profile", response_model=CoachProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: CoachProfileCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachIdentityService(db).create_profile(current_user.id, data, get_client_ip(request))


@router.get("/profile", response_model=CoachProfileResponse)
async def get_profile(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachIdentityService(db).get_profile(coach.id)


@router.patch("/profile", response_model=CoachProfileResponse)
async def patch_profile(
    data: CoachProfileUpdate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachIdentityService(db).update_profile(coach.id, data, get_client_ip(request))


@router.post("/invitations", response_model=CoachInvitationCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    data: CoachInvitationCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachInvitationService(db).create(coach.id, data, get_client_ip(request))


@router.get("/invitations", response_model=list[CoachInvitationResponse])
async def list_invitations(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachInvitationService(db).list(coach.id)


@router.get("/invitations/resolve", response_model=CoachInvitationResolveResponse)
async def resolve_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    # Invitation tokens are bearer secrets; keep this query parameter out of request logs.
    return await CoachInvitationService(db).resolve(token)


@router.post("/invitations/accept", response_model=CoachClientResponse)
async def accept_invitation(
    data: CoachInvitationAccept,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachInvitationService(db).accept(current_user.id, data.token, get_client_ip(request))


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: str,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    await CoachInvitationService(db).revoke(coach.id, invitation_id, get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/clients", response_model=list[CoachClientResponse])
async def list_clients(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachRelationshipService(db).list_clients(coach.id)


@router.get("/clients/{client_id}", response_model=CoachClientDetailResponse)
async def get_client(client_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachRelationshipService(db).get_client(coach.id, client_id)


@router.patch("/clients/{client_id}", response_model=CoachClientResponse)
async def patch_client(
    client_id: int, data: CoachClientUpdate, request: Request, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    return await CoachRelationshipService(db).update_client(coach.id, client_id, data, get_client_ip(request))


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int, request: Request, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    await CoachRelationshipService(db).revoke_client(coach.id, client_id, get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
