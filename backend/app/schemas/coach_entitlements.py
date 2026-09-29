from datetime import datetime

from pydantic import BaseModel


class CoachQuota(BaseModel):
    used: int
    limit: int | None
    remaining: int | None


class CoachFeatures(BaseModel):
    client_monitoring: bool
    program_assignments: bool
    advanced_monitoring_filters: bool


class CoachSubscriptionResponse(BaseModel):
    plan: str
    status: str
    trial_started_at: datetime | None
    trial_ends_at: datetime | None
    trial_days_remaining: int | None
    grace_ends_at: datetime | None
    grace_days_remaining: int | None
    period_started_at: datetime | None
    period_ends_at: datetime | None
    activated_at: datetime | None
    cancelled_at: datetime | None
    cancel_at_period_end: bool
    active_clients: CoachQuota
    active_programs: CoachQuota
    features: CoachFeatures
    upgrade_required: bool


class CoachPlanResponse(BaseModel):
    plan: str
    display_name: str
    limits: dict[str, int | None]
    available_features: CoachFeatures
