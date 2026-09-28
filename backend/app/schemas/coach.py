from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.coach_client import CoachClientStatus


class CoachClientPermissions(BaseModel):
    """Sprint 10.1 grants no granular data permissions."""

    model_config = ConfigDict(extra="forbid", frozen=True)


DEFAULT_COACH_CLIENT_PERMISSIONS = CoachClientPermissions()


class CoachProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)
    specializations: list[str] = Field(default_factory=list, max_length=30)
    avatar_url: str | None = Field(default=None, max_length=2048)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    public_slug: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")


class CoachProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)
    specializations: list[str] | None = Field(default=None, max_length=30)
    avatar_url: str | None = Field(default=None, max_length=2048)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    public_slug: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")


class CoachProfileResponse(CoachProfileCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CoachInvitationCreate(BaseModel):
    client_hint: str | None = Field(default=None, max_length=255)


class CoachInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    coach_id: int
    client_hint: str | None
    status: str
    expires_at: datetime
    accepted_by_user_id: int | None
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class CoachInvitationCreatedResponse(CoachInvitationResponse):
    token: str = Field(description="Shown once only; it is never persisted.")


class CoachInvitationResolveResponse(BaseModel):
    invitation_id: str
    coach: CoachProfileResponse
    permissions: CoachClientPermissions = DEFAULT_COACH_CLIENT_PERMISSIONS
    expires_at: datetime


class CoachInvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class CoachClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    client_id: int
    status: CoachClientStatus
    permissions: CoachClientPermissions
    started_at: datetime
    ended_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CoachClientDetailResponse(CoachClientResponse):
    client_first_name: str | None
    client_username: str | None


class CoachClientUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: CoachClientStatus | None = None
