from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.application.challenges_service import ChallengesService
from app.application.emergency_service import EmergencyService
from app.domain.exceptions import (
    ChallengeForbiddenError,
    ChallengeValidationError,
    EmergencyValidationError,
)
from app.middleware.rate_limit import (
    POLICY_ANALYTICS,
    POLICY_AUTH,
    POLICY_DEFAULT,
    POLICY_EMERGENCY_NOTIFY,
    POLICY_EXPORT,
    POLICY_SYSTEM,
    POLICY_WORKOUTS,
    POLICY_WRITE,
    RateLimitMiddleware,
    rate_limit,
)
from app.middleware.sentry_scope import SentryUserContextMiddleware
from app.schemas.challenges import ChallengeCreate, ChallengeGoal
from app.schemas.emergency import EmergencyContactCreate, EmergencyNotifyRequest
from app.settings import settings


def _challenge(**overrides):
    now = datetime.utcnow()
    data = {
        "id": 7,
        "creator_id": 42,
        "name": "Steps",
        "description": None,
        "type": "workout_count",
        "goal": {"type": "count", "target": 10, "unit": "workouts"},
        "start_date": date.today(),
        "end_date": date.today() + timedelta(days=7),
        "is_public": True,
        "join_code": None,
        "max_participants": 0,
        "rules": {},
        "banner_url": None,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


class _ChallengeRepo:
    def __init__(self, challenge=None):
        self.challenge = challenge or _challenge()

    async def count_challenges(self, *_args, **_kwargs):
        return 1

    async def list_challenges(self, *_args, **_kwargs):
        return [self.challenge]

    async def get_user(self, user_id):
        return SimpleNamespace(first_name=f"User {user_id}")

    async def create_challenge(self, challenge):
        challenge.id = 99
        challenge.created_at = datetime.utcnow()
        challenge.updated_at = datetime.utcnow()
        return challenge

    async def get_challenge(self, _challenge_id):
        return self.challenge


@pytest.mark.asyncio
async def test_challenges_service_covers_policy_branches(monkeypatch):
    monkeypatch.setattr(ChallengesService, "_generate_join_code", staticmethod(lambda: "JOIN123"))
    service = object.__new__(ChallengesService)
    service.repository = _ChallengeRepo()

    listed = await service.get_challenges(None, None, None, page=1, page_size=20, creator_id=42)
    assert listed.total == 1
    assert listed.filters.mine is True
    assert listed.items[0].creator_name == "User 42"

    data = ChallengeCreate(
        name="Future private",
        type="workout_count",
        goal=ChallengeGoal(type="count", target=5, unit="workouts"),
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=10),
        is_public=False,
    )
    created = await service.create_challenge(42, "Ada", data, client_ip="127.0.0.1")
    assert created.status == "upcoming"
    assert created.join_code == "JOIN123"

    service.repository = _ChallengeRepo(_challenge(status="completed"))
    with pytest.raises(ChallengeValidationError):
        await service.join_challenge(42, 7, None)

    service.repository = _ChallengeRepo(_challenge(status="cancelled"))
    with pytest.raises(ChallengeValidationError):
        await service.join_challenge(42, 7, None)

    service.repository = _ChallengeRepo(_challenge(is_public=False, join_code="SECRET"))
    with pytest.raises(ChallengeForbiddenError):
        await service.join_challenge(42, 7, "wrong")

    joined = await service.join_challenge(42, 7, "secret")
    assert joined.success is True


class _EmergencyRepo:
    def __init__(self, contacts=None):
        self.contacts = contacts or []

    async def list_contacts(self, user_id):
        return self.contacts

    async def create_contact(self, contact):
        contact.id = 1
        contact.created_at = datetime.utcnow()
        contact.updated_at = datetime.utcnow()
        return contact

    async def list_active_contacts_for_emergency(self, user_id):
        return self.contacts

    async def list_contacts_for_workout_start(self, user_id):
        return self.contacts

    async def list_contacts_for_workout_end(self, user_id):
        return self.contacts


def _contact(**overrides):
    now = datetime.utcnow()
    data = {
        "id": 1,
        "user_id": 5,
        "contact_name": "Contact",
        "contact_username": None,
        "phone": None,
        "relationship_type": None,
        "is_active": True,
        "notify_on_workout_start": True,
        "notify_on_workout_end": True,
        "notify_on_emergency": True,
        "priority": 1,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


@pytest.mark.asyncio
async def test_emergency_service_covers_notification_branches():
    user = SimpleNamespace(id=5, first_name=None, username="runner")
    service = object.__new__(EmergencyService)
    service.repository = _EmergencyRepo()

    with pytest.raises(EmergencyValidationError):
        await service.create_contact(5, EmergencyContactCreate(contact_name="No method"))

    with pytest.raises(EmergencyValidationError):
        await service.send_emergency_notification(user, EmergencyNotifyRequest())

    service.repository = _EmergencyRepo(
        [
            _contact(id=1, contact_username="helper"),
            _contact(id=2, phone="+100000000"),
            _contact(id=3),
        ]
    )
    created = await service.create_contact(
        5,
        EmergencyContactCreate(contact_name="Helper", contact_username="helper"),
    )
    assert created.contact_username == "helper"

    notified = await service.send_emergency_notification(
        user,
        EmergencyNotifyRequest(message="Need help", location="Gym"),
    )
    assert notified.successful_count == 2
    assert notified.failed_count == 1
    assert "runner" in notified.message_sent

    start = await service.notify_workout_start(user, workout_id=10, estimated_duration=45)
    assert start.contacts_notified == 3
    assert "estimated 45 min" in start.preview

    end = await service.notify_workout_end(user, workout_id=10, duration=30, completed_successfully=False)
    assert end.contacts_notified == 3
    assert "ended" in end.preview


def test_rate_limit_policy_resolution_covers_specific_tiers():
    mw = RateLimitMiddleware(MagicMock())

    assert mw._resolve_policy("/api/v1/analytics/export", "GET")[0] == POLICY_EXPORT
    assert mw._resolve_policy("/api/v1/system/emergency/notify", "POST")[0] == POLICY_EMERGENCY_NOTIFY
    assert mw._resolve_policy("/api/v1/workouts/templates", "GET")[0] == POLICY_WORKOUTS
    assert mw._resolve_policy("/api/v1/analytics/summary", "GET")[0] == POLICY_ANALYTICS
    assert mw._resolve_policy("/api/v1/users/auth/refresh", "POST")[0] == POLICY_AUTH
    assert mw._resolve_policy("/api/v1/system/ready", "GET")[0] == POLICY_SYSTEM
    assert mw._resolve_policy("/api/v1/users/me", "PATCH")[0] == POLICY_WRITE
    assert mw._resolve_policy("/api/v1/users/me", "GET")[0] == POLICY_DEFAULT


@pytest.mark.asyncio
async def test_rate_limit_decorator_request_extraction_branches():
    calls = []

    class Req:
        headers = {"X-Forwarded-For": "10.0.0.1, 10.0.0.2"}
        client = SimpleNamespace(host="127.0.0.1")

    @rate_limit(key_func=lambda request: calls.append(request))
    async def with_kwarg(*, request):
        return "ok"

    @rate_limit()
    async def with_arg(request):
        return "ok"

    @rate_limit()
    async def without_request():
        return "ok"

    req = Req()
    assert await with_kwarg(request=req) == "ok"
    assert calls == [req]
    assert await with_arg(req) == "ok"
    assert await without_request() == "ok"


@pytest.mark.asyncio
async def test_sentry_scope_sets_user_when_enabled(monkeypatch):
    seen = []

    class Scope:
        def set_user(self, user):
            seen.append(user)

    @contextmanager
    def fake_scope():
        yield Scope()

    monkeypatch.setattr(settings, "SENTRY_DSN", "https://example@sentry.invalid/1")
    monkeypatch.setattr("app.middleware.sentry_scope.sentry_sdk.configure_scope", fake_scope)

    app = FastAPI()

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    app.add_middleware(SentryUserContextMiddleware)
    transport = ASGITransport(app=app)
    token = __import__("app.core.security", fromlist=["create_access_token"]).create_access_token(777)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ping", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert seen == [{"id": "777"}]
