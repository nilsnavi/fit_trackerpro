from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import coach as coach_deps
from app.domain.exceptions import (
    CoachClientRelationshipNotFound,
    CoachFeatureDisabled,
    CoachRoleRequired,
)
from app.domain.user import User


@pytest.mark.asyncio
async def test_coach_feature_dependency_allows_enabled_and_rejects_disabled(monkeypatch):
    state = {"enabled": False}

    async def feature_enabled(_db, key: str) -> bool:
        assert key == "coach"
        return state["enabled"]

    monkeypatch.setattr(coach_deps, "is_feature_enabled", feature_enabled)
    db = cast(AsyncSession, object())

    with pytest.raises(CoachFeatureDisabled):
        await coach_deps.require_coach_feature(db)

    state["enabled"] = True
    assert await coach_deps.require_coach_feature(db) is None


@pytest.mark.asyncio
async def test_coach_role_dependency_rejects_non_coach_and_returns_coach(monkeypatch):
    role = {"enabled": False}
    current_user = cast(User, SimpleNamespace(id=123))

    async def has_role(self, user_id: int, role_name) -> bool:
        assert user_id == current_user.id
        assert role_name == coach_deps.UserRoleName.COACH
        return role["enabled"]

    monkeypatch.setattr(coach_deps.UserRoleRepository, "has_role", has_role)
    db = cast(AsyncSession, object())

    with pytest.raises(CoachRoleRequired):
        await coach_deps.require_coach(current_user, db)

    role["enabled"] = True
    assert await coach_deps.require_coach(current_user, db) is current_user


@pytest.mark.asyncio
async def test_active_client_dependency_is_owner_scoped_and_requires_active_relation(monkeypatch):
    coach = cast(User, SimpleNamespace(id=10))
    relation = object()
    result = {"value": None}
    calls = []

    async def get_for_coach(self, coach_id: int, client_id: int, *, active_only: bool = False):
        calls.append((coach_id, client_id, active_only))
        return result["value"]

    monkeypatch.setattr(coach_deps.CoachClientRepository, "get_for_coach", get_for_coach)
    db = cast(AsyncSession, object())

    with pytest.raises(CoachClientRelationshipNotFound):
        await coach_deps.require_active_coach_client(20, coach, db)

    result["value"] = relation
    assert await coach_deps.require_active_coach_client(20, coach, db) is relation
    assert calls == [(10, 20, True), (10, 20, True)]
