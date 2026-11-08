from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.coach_business import (
    CoachClientPackageStatus,
    CoachPackageStatus,
    CoachPackageUsage,
    CoachPaymentStatus,
    CoachTaskPriority,
    CoachTaskSource,
)


class CoachPackageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    sessions_total: int = Field(ge=1, le=1000)
    validity_days: int | None = Field(default=None, ge=1, le=3650)
    price_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str = Field(default="RUB", min_length=3, max_length=3)


class CoachPackageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    sessions_total: int | None = Field(default=None, ge=1, le=1000)
    validity_days: int | None = Field(default=None, ge=1, le=3650)
    price_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class CoachPackageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    coach_id: int
    name: str
    description: str | None
    sessions_total: int
    validity_days: int | None
    price_amount: Decimal | None
    currency: str
    status: CoachPackageStatus
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CoachClientPackageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    package_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sessions_total: int | None = Field(default=None, ge=1, le=1000)
    validity_days: int | None = Field(default=None, ge=1, le=3650)
    price_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    expires_at: date | None = None
    auto_consume: bool = False


class CoachClientPackageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    coach_id: int
    client_id: int
    relationship_id: int
    package_id: int | None
    name: str
    sessions_total: int
    sessions_used: int
    sessions_remaining: int
    price_amount: Decimal | None
    currency: str
    purchased_at: datetime
    expires_at: date | None
    auto_consume: bool
    status: CoachClientPackageStatus
    created_at: datetime
    updated_at: datetime


class CoachPackageConsumeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(default=None, max_length=500)
    workout_id: int | None = Field(default=None, ge=1)


class CoachPackageReverseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(default=None, max_length=500)


class CoachPackageUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_package_id: int
    delta: int
    reason: str
    workout_id: int | None
    actor_user_id: int | None
    idempotency_key: str | None
    reversal_of_usage_id: int | None
    note: str | None
    created_at: datetime


class CoachClientPackageDetailResponse(CoachClientPackageResponse):
    usage: list[CoachPackageUsageResponse] = Field(default_factory=list)


class CoachPaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    method: str = Field(default="CASH", pattern="^(CASH|CARD|TRANSFER|OTHER)$")
    paid_at: datetime | None = None
    client_package_id: int | None = Field(default=None, ge=1)
    comment: str | None = Field(default=None, max_length=1000)


class CoachPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    coach_id: int
    client_id: int
    relationship_id: int
    client_package_id: int | None
    amount: Decimal
    currency: str
    method: str
    status: CoachPaymentStatus
    paid_at: datetime
    comment: str | None
    reversed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CoachTaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    priority: CoachTaskPriority = CoachTaskPriority.NORMAL
    due_at: datetime | None = None


class CoachTaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    priority: CoachTaskPriority | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None


class CoachTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    coach_id: int
    client_id: int | None
    title: str
    description: str | None
    priority: CoachTaskPriority
    due_at: datetime | None
    source: CoachTaskSource
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


# Re-exported for router typing convenience.
__all__ = [
    "CoachPackageCreate",
    "CoachPackageUpdate",
    "CoachPackageResponse",
    "CoachClientPackageCreate",
    "CoachClientPackageResponse",
    "CoachClientPackageDetailResponse",
    "CoachPackageConsumeRequest",
    "CoachPackageReverseRequest",
    "CoachPackageUsageResponse",
    "CoachPaymentCreate",
    "CoachPaymentResponse",
    "CoachTaskCreate",
    "CoachTaskUpdate",
    "CoachTaskResponse",
    "CoachPackageUsage",
]
