"""V2-03C.1: no grant is implied by role, relation or subscription."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_client_grant import (
    COACH_GRANT_CONSENT_VERSION,
    TRAINING_SUMMARY_READ,
    CoachClientGrant,
    CoachGrantStatus,
)
from app.domain.coach_profile import CoachProfile
from app.domain.user import User
from app.domain.user_role import UserRole, UserRoleName
from app.infrastructure.repositories.coach_grant_repository import CoachGrantRepository


@pytest.mark.asyncio
async def test_coach_grants_are_default_deny_and_exact_owner_scoped(db_session):
    coach, other_coach, athlete = (
        User(telegram_id=981001), User(telegram_id=981002), User(telegram_id=981003)
    )
    db_session.add_all([coach, other_coach, athlete])
    await db_session.flush()
    db_session.add_all([
        CoachProfile(user_id=coach.id, display_name="Coach A", specializations=[]),
        CoachProfile(user_id=other_coach.id, display_name="Coach B", specializations=[]),
        UserRole(user_id=coach.id, role=UserRoleName.COACH),
        UserRole(user_id=other_coach.id, role=UserRoleName.COACH),
    ])
    relation = CoachClient(coach_id=coach.id, client_id=athlete.id, status=CoachClientStatus.ACTIVE, permissions={})
    db_session.add(relation)
    await db_session.commit()
    await db_session.refresh(relation)

    grants = CoachGrantRepository(db_session)
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)

    grant = CoachClientGrant(
        relationship_id=relation.id, coach_id=coach.id, client_id=athlete.id,
        scope=TRAINING_SUMMARY_READ, status=CoachGrantStatus.ACTIVE,
        consent_version=COACH_GRANT_CONSENT_VERSION,
        granted_at=datetime.now(UTC) - timedelta(days=1),
    )
    db_session.add(grant)
    await db_session.commit()
    assert await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    assert not await grants.is_allowed(coach_id=other_coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope="health_metrics.read")
    assert not await grants.is_allowed(coach_id=coach.id, client_id=other_coach.id, scope=TRAINING_SUMMARY_READ)

    grant.status = CoachGrantStatus.REVOKED
    grant.revoked_at = datetime.now(UTC)
    await db_session.commit()
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)


@pytest.mark.asyncio
async def test_grant_requires_active_relation_current_version_and_not_expired(db_session):
    coach = User(telegram_id=982001)
    athlete = User(telegram_id=982002)
    db_session.add_all([coach, athlete])
    await db_session.flush()
    db_session.add_all([
        CoachProfile(user_id=coach.id, display_name="Coach", specializations=[]),
        UserRole(user_id=coach.id, role=UserRoleName.COACH),
    ])
    relation = CoachClient(coach_id=coach.id, client_id=athlete.id, status=CoachClientStatus.ACTIVE, permissions={})
    db_session.add(relation)
    await db_session.flush()
    grant = CoachClientGrant(
        relationship_id=relation.id, coach_id=coach.id, client_id=athlete.id,
        scope=TRAINING_SUMMARY_READ, status=CoachGrantStatus.ACTIVE,
        consent_version=COACH_GRANT_CONSENT_VERSION,
        granted_at=datetime.now(UTC)-timedelta(days=5),
        expires_at=datetime.now(UTC)-timedelta(days=1),
    )
    db_session.add(grant)
    await db_session.execute(text("INSERT INTO feature_flags (key, enabled) VALUES ('coach', true)"))
    await db_session.commit()
    grants = CoachGrantRepository(db_session)
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    grant.expires_at = datetime.now(UTC) + timedelta(days=1)
    grant.consent_version = "outdated"
    await db_session.commit()
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    grant.consent_version = COACH_GRANT_CONSENT_VERSION
    await db_session.commit()
    assert await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
    relation.status = CoachClientStatus.PAUSED
    await db_session.commit()
    assert not await grants.is_allowed(coach_id=coach.id, client_id=athlete.id, scope=TRAINING_SUMMARY_READ)
