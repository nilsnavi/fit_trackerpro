"""Revocable refresh sessions: rotation, reuse detection, logout, deletion, expiry."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core.security import decode_refresh_token
from app.domain.refresh_session import RefreshSession
from app.settings import settings
from app.tests.telegram_webapp import build_init_data

_AUTH = "/api/v1/users/auth"


async def _login(client: AsyncClient, tg_id: int) -> tuple[str, str]:
    user = {"id": tg_id, "first_name": "Refresh", "username": f"refresh{tg_id}"}
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=user)
    response = await client.post(f"{_AUTH}/telegram", json={"init_data": init_data})
    assert response.status_code == 200, response.text
    body = response.json()
    return body["access_token"], body["refresh_token"]


def _auth_header(access: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access}"}


@pytest.mark.unit
@pytest.mark.auth
async def test_refresh_rotates_and_reuse_revokes_family(client: AsyncClient):
    _access, refresh1 = await _login(client, 930_000_001)

    rotated = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh1})
    assert rotated.status_code == 200, rotated.text
    refresh2 = rotated.json()["refresh_token"]
    assert refresh2 != refresh1

    # Reuse of the burned token is rejected and burns the whole family.
    reuse = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh1})
    assert reuse.status_code == 401

    # The rotated token is now revoked too (family revoked on reuse).
    after = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh2})
    assert after.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_logout_revokes_specific_session(client: AsyncClient):
    access, refresh = await _login(client, 930_000_002)
    out = await client.post(
        f"{_AUTH}/logout",
        headers=_auth_header(access),
        json={"refresh_token": refresh},
    )
    assert out.status_code == 200, out.text

    reused = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh})
    assert reused.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_logout_without_body_revokes_all_sessions(client: AsyncClient):
    access, refresh = await _login(client, 930_000_003)
    out = await client.post(f"{_AUTH}/logout", headers=_auth_header(access))
    assert out.status_code == 200

    reused = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh})
    assert reused.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_account_deletion_invalidates_refresh(client: AsyncClient):
    access, refresh = await _login(client, 930_000_004)
    deleted = await client.delete("/api/v1/users/me", headers=_auth_header(access))
    assert deleted.status_code == 204, deleted.text

    reused = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh})
    assert reused.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
async def test_expired_session_is_rejected(client: AsyncClient, db_session):
    _access, refresh = await _login(client, 930_000_005)
    payload = decode_refresh_token(refresh)
    assert payload is not None and isinstance(payload.get("jti"), str)

    await db_session.execute(
        update(RefreshSession)
        .where(RefreshSession.jti == payload["jti"])
        .values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    )
    await db_session.commit()

    expired = await client.post(f"{_AUTH}/refresh", json={"refresh_token": refresh})
    assert expired.status_code == 401