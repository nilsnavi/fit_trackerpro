"""Client-only grant API DTOs; disallow unknown consent fields."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.coach_client_grant import COACH_GRANT_CONSENT_VERSION


class GrantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coach_id: int = Field(gt=0)
    scope: Literal["training_summary.read", "workout_history.read"]
    consent_version: Literal["v2-03c-1"]
    expires_at: datetime | None = None


class GrantView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    coach_id: int
    scope: str
    status: str
    consent_version: str
    granted_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None


GRANT_CONSENT_VERSION = COACH_GRANT_CONSENT_VERSION


class AvailableCoach(BaseModel):
    """The athlete's ACTIVE coach link only; excludes other clients and profile secrets."""

    model_config = ConfigDict(extra="forbid")

    coach_id: int
    display_name: str
