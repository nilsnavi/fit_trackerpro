from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class CoachPlan(StrEnum):
    FREE = "FREE"
    TRAINER_PRO = "TRAINER_PRO"


class CoachSubscriptionStatus(StrEnum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    GRACE = "GRACE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


@dataclass(frozen=True)
class CoachPlanDefinition:
    display_name: str
    active_client_limit: int | None
    active_program_limit: int | None
    advanced_monitoring_filters: bool


PLAN_CATALOG = {
    CoachPlan.FREE: CoachPlanDefinition("Бесплатный", 3, 2, False),
    CoachPlan.TRAINER_PRO: CoachPlanDefinition("Trainer Pro", None, None, True),
}


@dataclass(frozen=True)
class EntitlementDecision:
    plan: CoachPlan
    status: CoachSubscriptionStatus
    trial_started_at: datetime | None
    trial_ends_at: datetime | None
    period_started_at: datetime | None
    grace_ends_at: datetime | None
    period_ends_at: datetime | None
    activated_at: datetime | None
    cancelled_at: datetime | None
    cancel_at_period_end: bool
    active_clients_used: int
    active_programs_used: int
    allowed: bool = True
    code: str = "ALLOWED"

    @property
    def upgrade_required(self) -> bool:
        return self.plan == CoachPlan.FREE

    @property
    def definition(self) -> CoachPlanDefinition:
        return PLAN_CATALOG[self.plan]

    def limit(self, kind: str) -> int | None:
        field = {"clients": "active_client_limit", "programs": "active_program_limit"}[kind]
        return getattr(self.definition, field)

    def used(self, kind: str) -> int:
        return getattr(self, f"active_{kind}_used")

    def remaining(self, kind: str) -> int | None:
        limit = self.limit(kind)
        return None if limit is None else max(0, limit - self.used(kind))

    def has_feature(self, feature: str) -> bool:
        if feature == "advanced_monitoring_filters":
            return self.definition.advanced_monitoring_filters
        return feature in {"client_monitoring", "program_assignments"}


@dataclass(frozen=True)
class EntitlementCheck:
    allowed: bool
    code: str
    plan: CoachPlan
    limit: int | None
    used: int
    remaining: int | None
    upgrade_required: bool
