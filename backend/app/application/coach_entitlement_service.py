from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_entitlement import CoachPlan, CoachSubscriptionStatus, EntitlementCheck, EntitlementDecision, PLAN_CATALOG
from app.domain.coach_profile import CoachProfile
from app.domain.coach_program import CoachProgram
from app.domain.coach_subscription import CoachSubscription
from app.domain.exceptions import CoachEntitlementDenied, CoachProfileNotFound

TRIAL_DURATION = timedelta(days=14)
GRACE_DURATION = timedelta(days=3)


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class CoachEntitlementService:
    """Server authority for Coach subscription state, quotas and product capabilities."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_trial_for_new_profile(self, coach_id: int) -> CoachSubscription:
        now = datetime.now(UTC)
        subscription = CoachSubscription(
            coach_id=coach_id,
            plan=CoachPlan.TRAINER_PRO.value,
            status=CoachSubscriptionStatus.TRIAL.value,
            trial_started_at=now,
            trial_ends_at=now + TRIAL_DURATION,
            activated_at=now,
        )
        self.db.add(subscription)
        await self.db.flush()
        audit_log(action="coach.subscription.created", user_db_id=coach_id, resource_type="coach_subscription", meta={"plan": CoachPlan.TRAINER_PRO.value, "status": CoachSubscriptionStatus.TRIAL.value})
        audit_log(action="coach.subscription.trial_started", user_db_id=coach_id, resource_type="coach_subscription", meta={"plan": CoachPlan.TRAINER_PRO.value, "duration_days": 14})
        return subscription

    async def _locked_subscription(self, coach_id: int) -> CoachSubscription:
        profile_exists = await self.db.scalar(select(CoachProfile.user_id).where(CoachProfile.user_id == coach_id))
        if profile_exists is None:
            raise CoachProfileNotFound()
        subscription = await self.db.scalar(
            select(CoachSubscription).where(CoachSubscription.coach_id == coach_id).with_for_update()
        )
        if subscription is None:
            # Compatibility for profiles introduced outside the identity service: legacy means FREE.
            subscription = CoachSubscription(coach_id=coach_id, plan="FREE", status="ACTIVE")
            self.db.add(subscription)
            await self.db.flush()
            audit_log(action="coach.subscription.created", user_db_id=coach_id, resource_type="coach_subscription", meta={"plan": CoachPlan.FREE.value, "status": CoachSubscriptionStatus.ACTIVE.value})
            subscription = await self.db.scalar(
                select(CoachSubscription).where(CoachSubscription.coach_id == coach_id).with_for_update()
            )
        assert subscription is not None
        return subscription

    async def _advance(self, row: CoachSubscription, now: datetime) -> None:
        trial_end = _utc(row.trial_ends_at)
        grace_end = _utc(row.grace_ends_at)
        period_end = _utc(row.current_period_ends_at)
        if row.status == CoachSubscriptionStatus.TRIAL and trial_end and now >= trial_end:
            row.status = CoachSubscriptionStatus.GRACE.value
            row.grace_started_at = trial_end
            row.grace_ends_at = trial_end + GRACE_DURATION
            audit_log(action="coach.subscription.trial_expired", user_db_id=row.coach_id, resource_type="coach_subscription", meta={"plan": row.plan})
            audit_log(action="coach.subscription.grace_started", user_db_id=row.coach_id, resource_type="coach_subscription", meta={"duration_days": 3})
            grace_end = trial_end + GRACE_DURATION
        if row.cancel_at_period_end and period_end and now >= period_end:
            row.plan = CoachPlan.FREE.value
            row.status = CoachSubscriptionStatus.CANCELLED.value
            row.cancelled_at = period_end
            row.expired_at = period_end
            row.cancel_at_period_end = False
            audit_log(action="coach.subscription.downgraded", user_db_id=row.coach_id, resource_type="coach_subscription", meta={"reason": "period_end_cancel"})
        elif row.status == CoachSubscriptionStatus.GRACE and grace_end and now >= grace_end:
            row.plan = CoachPlan.FREE.value
            row.status = CoachSubscriptionStatus.ACTIVE.value
            row.expired_at = grace_end
            audit_log(action="coach.subscription.downgraded", user_db_id=row.coach_id, resource_type="coach_subscription", meta={"reason": "grace_ended"})

    async def _decision(self, row: CoachSubscription) -> EntitlementDecision:
        clients = int(await self.db.scalar(
            select(func.count(CoachClient.id)).where(
                CoachClient.coach_id == row.coach_id,
                CoachClient.status.in_((CoachClientStatus.ACTIVE, CoachClientStatus.PAUSED)),
            )
        ) or 0)
        programs = int(await self.db.scalar(
            select(func.count(CoachProgram.id)).where(
                CoachProgram.coach_id == row.coach_id,
                CoachProgram.status.in_(("DRAFT", "ACTIVE")),
            )
        ) or 0)
        return EntitlementDecision(
            plan=CoachPlan(row.plan), status=CoachSubscriptionStatus(row.status),
            trial_started_at=row.trial_started_at, trial_ends_at=row.trial_ends_at,
            period_started_at=row.current_period_started_at, grace_ends_at=row.grace_ends_at,
            period_ends_at=row.current_period_ends_at, activated_at=row.activated_at,
            cancelled_at=row.cancelled_at,
            cancel_at_period_end=row.cancel_at_period_end,
            active_clients_used=clients, active_programs_used=programs,
        )

    async def get_current(self, coach_id: int) -> EntitlementDecision:
        row = await self._locked_subscription(coach_id)
        await self._advance(row, datetime.now(UTC))
        await self.db.commit()
        return await self._decision(row)

    async def require_capacity(self, coach_id: int, kind: str) -> EntitlementDecision:
        row = await self._locked_subscription(coach_id)
        await self._advance(row, datetime.now(UTC))
        decision = await self._decision(row)
        limit = decision.limit(kind)
        used = decision.used(kind)
        if limit is not None and used >= limit:
            code = "CLIENT_LIMIT_REACHED" if kind == "clients" else "PROGRAM_LIMIT_REACHED"
            message = "Достигнут лимит клиентов тарифа" if kind == "clients" else "Достигнут лимит программ тарифа"
            details = {"plan": decision.plan.value, "used": used, "limit": limit, "remaining": 0, "upgrade_required": True}
            audit_log(action="coach.entitlement.blocked", user_db_id=coach_id, resource_type="coach_entitlement", meta={"coach_id": coach_id, "entitlement_code": code, "plan": decision.plan.value, "used": used, "limit": limit})
            raise CoachEntitlementDenied(message, business_code=code, details=details)
        return decision

    async def require_feature(self, coach_id: int, feature: str) -> EntitlementDecision:
        row = await self._locked_subscription(coach_id)
        await self._advance(row, datetime.now(UTC))
        decision = await self._decision(row)
        if not decision.has_feature(feature):
            details = {"plan": decision.plan.value, "upgrade_required": True, "feature": feature}
            audit_log(action="coach.entitlement.blocked", user_db_id=coach_id, resource_type="coach_entitlement", meta={"coach_id": coach_id, "entitlement_code": "FEATURE_REQUIRES_TRAINER_PRO", "plan": decision.plan.value, "feature": feature})
            raise CoachEntitlementDenied("Эта функция доступна в тарифе Trainer Pro", business_code="FEATURE_REQUIRES_TRAINER_PRO", details=details)
        return decision

    async def get_plan(self, coach_id: int) -> CoachPlan:
        return (await self.get_current(coach_id)).plan

    async def get_entitlements(self, coach_id: int) -> EntitlementDecision:
        return await self.get_current(coach_id)

    async def usage(self, coach_id: int) -> dict[str, int]:
        decision = await self.get_current(coach_id)
        return {"active_clients": decision.active_clients_used, "active_programs": decision.active_programs_used}

    async def _check_capacity(self, coach_id: int, kind: str) -> EntitlementCheck:
        decision = await self.get_current(coach_id)
        limit = decision.limit(kind)
        used = decision.used(kind)
        allowed = limit is None or used < limit
        code = "ALLOWED" if allowed else ("CLIENT_LIMIT_REACHED" if kind == "clients" else "PROGRAM_LIMIT_REACHED")
        return EntitlementCheck(allowed, code, decision.plan, limit, used, decision.remaining(kind), not allowed)

    async def can_add_client(self, coach_id: int) -> EntitlementCheck:
        return await self._check_capacity(coach_id, "clients")

    async def can_create_program(self, coach_id: int) -> EntitlementCheck:
        return await self._check_capacity(coach_id, "programs")

    async def can_use_feature(self, coach_id: int, feature: str) -> EntitlementCheck:
        decision = await self.get_current(coach_id)
        allowed = decision.has_feature(feature)
        return EntitlementCheck(allowed, "ALLOWED" if allowed else "FEATURE_REQUIRES_TRAINER_PRO", decision.plan, None, 0, None, not allowed)

    async def require_entitlement(self, coach_id: int, *, kind: str | None = None, feature: str | None = None) -> EntitlementDecision:
        if kind is not None:
            return await self.require_capacity(coach_id, kind)
        if feature is not None:
            return await self.require_feature(coach_id, feature)
        raise ValueError("kind or feature is required")

    async def current_payload(self, coach_id: int) -> dict:
        decision = await self.get_current(coach_id)
        definition = decision.definition

        def quota(kind: str) -> dict:
            return {"used": decision.used(kind), "limit": decision.limit(kind), "remaining": decision.remaining(kind)}

        now = datetime.now(UTC)
        trial_end = _utc(decision.trial_ends_at)
        grace_end = _utc(decision.grace_ends_at)
        return {
            "plan": decision.plan.value, "status": decision.status.value,
            "trial_started_at": decision.trial_started_at, "trial_ends_at": decision.trial_ends_at,
            "trial_days_remaining": max(0, (trial_end - now).days) if trial_end and decision.status == CoachSubscriptionStatus.TRIAL else None,
            "grace_ends_at": decision.grace_ends_at,
            "grace_days_remaining": max(0, (grace_end - now).days) if grace_end and decision.status == CoachSubscriptionStatus.GRACE else None,
            "period_started_at": decision.period_started_at, "period_ends_at": decision.period_ends_at,
            "activated_at": decision.activated_at, "cancelled_at": decision.cancelled_at,
            "cancel_at_period_end": decision.cancel_at_period_end,
            "active_clients": quota("clients"), "active_programs": quota("programs"),
            "features": {"client_monitoring": True, "program_assignments": True, "advanced_monitoring_filters": definition.advanced_monitoring_filters},
            "upgrade_required": decision.plan == CoachPlan.FREE,
        }

    @staticmethod
    def catalog_payload() -> list[dict]:
        return [{
            "plan": plan.value,
            "display_name": definition.display_name,
            "limits": {"active_clients": definition.active_client_limit, "active_programs": definition.active_program_limit},
            "available_features": {"client_monitoring": True, "program_assignments": True, "advanced_monitoring_filters": definition.advanced_monitoring_filters},
        } for plan, definition in PLAN_CATALOG.items()]
