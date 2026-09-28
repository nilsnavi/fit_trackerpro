"""PostgreSQL integration checks for Coach constraints and transaction races."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.coach_service import CoachInvitationService, invitation_token_hash
from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_invitation import CoachInvitation
from app.domain.exceptions import (
    CoachClientAlreadyExists,
    CoachInvitationAlreadyUsed,
    CoachInvitationRevoked,
)
from app.domain.user import User
from app.infrastructure.repositories.coach_repository import CoachInvitationRepository


async def _users(session: AsyncSession, *telegram_ids: int) -> tuple[int, ...]:
    users = [User(telegram_id=telegram_id, first_name=f"User {telegram_id}") for telegram_id in telegram_ids]
    session.add_all(users)
    await session.commit()
    return tuple(user.id for user in users)


async def _invitation(session: AsyncSession, coach_id: int, token: str) -> CoachInvitation:
    invitation = CoachInvitation(
        coach_id=coach_id,
        token_hash=invitation_token_hash(token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    session.add(invitation)
    await session.commit()
    return invitation


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgres_coach_constraints_are_installed_and_enforced(db_session: AsyncSession):
    indexes = await db_session.execute(
        text(
            "SELECT tablename, indexname, indexdef FROM pg_indexes "
            "WHERE schemaname = current_schema() AND tablename IN "
            "('coach_clients', 'coach_invitations', 'user_roles', 'coach_profiles')"
        )
    )
    definitions = [row.indexdef for row in indexes]
    required_indexes = (
        ("coach_clients", "coach_id, client_id", "WHERE", "ACTIVE"),
        ("coach_invitations", "token_hash", "", ""),
        ("user_roles", "user_id, role", "", ""),
        ("coach_profiles", "user_id", "", ""),
    )
    for table, columns, where, condition in required_indexes:
        matching = [
            definition
            for definition in definitions
            if f" ON public.{table} " in definition
            and columns in definition
            and (not where or where in definition.upper())
            and (not condition or condition in definition)
            and "CREATE UNIQUE INDEX" in definition.upper()
        ]
        assert matching, f"Missing unique index for {table}({columns})"

    checks = await db_session.execute(
        text(
            "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint "
            "WHERE connamespace = current_schema()::regnamespace "
            "AND conname = 'ck_coach_clients_not_self'"
        )
    )
    self_constraint = checks.one()
    assert "coach_id <> client_id" in self_constraint.definition

    coach_id, client_id = await _users(db_session, 819001, 819002)
    db_session.add(CoachClient(coach_id=coach_id, client_id=client_id, status=CoachClientStatus.ACTIVE))
    await db_session.commit()

    db_session.add(CoachClient(coach_id=coach_id, client_id=client_id, status=CoachClientStatus.ACTIVE))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()

    db_session.add(CoachClient(coach_id=coach_id, client_id=client_id, status=CoachClientStatus.PAUSED))
    await db_session.commit()
    db_session.add(CoachClient(coach_id=coach_id, client_id=coach_id, status=CoachClientStatus.ACTIVE))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgres_for_update_serializes_double_accept_and_replay(db_session: AsyncSession):
    coach_id, first_client_id, second_client_id = await _users(db_session, 819011, 819012, 819013)
    token = "postgres-double-accept-token"
    invitation = await _invitation(db_session, coach_id, token)
    sessions = async_sessionmaker(db_session.bind, class_=AsyncSession, expire_on_commit=False)

    async def accept(client_id: int):
        async with sessions() as session:
            return await CoachInvitationService(session).accept(client_id, token)

    outcomes = await asyncio.gather(
        accept(first_client_id), accept(second_client_id), return_exceptions=True
    )
    successes = [outcome for outcome in outcomes if not isinstance(outcome, Exception)]
    failures = [outcome for outcome in outcomes if isinstance(outcome, Exception)]
    assert len(successes) == 1
    assert len(failures) == 1 and isinstance(failures[0], CoachInvitationAlreadyUsed)

    stored = await db_session.get(CoachInvitation, invitation.id)
    assert stored is not None
    await db_session.refresh(stored)
    assert stored.status == "ACCEPTED"
    relationships = await db_session.scalars(
        select(CoachClient).where(CoachClient.coach_id == coach_id)
    )
    assert len(list(relationships)) == 1
    with pytest.raises(CoachInvitationAlreadyUsed):
        async with sessions() as session:
            await CoachInvitationService(session).accept(second_client_id, token)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgres_accept_waits_for_revoke_lock(db_session: AsyncSession):
    coach_id, client_id = await _users(db_session, 819021, 819022)
    token = "postgres-accept-revoke-token"
    invitation = await _invitation(db_session, coach_id, token)
    sessions = async_sessionmaker(db_session.bind, class_=AsyncSession, expire_on_commit=False)

    async with sessions() as revoker:
        locked = await CoachInvitationRepository(revoker).get_for_coach(
            coach_id, invitation.id, lock=True
        )
        assert locked is not None

        async with sessions() as accepter:
            backend_pid = await accepter.scalar(text("SELECT pg_backend_pid()"))
            accept_task = asyncio.create_task(CoachInvitationService(accepter).accept(client_id, token))
            async with sessions() as observer:
                async def waiting_on_lock() -> bool:
                    return bool(
                        await observer.scalar(
                            text(
                                "SELECT EXISTS (SELECT 1 FROM pg_stat_activity "
                                "WHERE pid = :pid AND wait_event_type = 'Lock')"
                            ),
                            {"pid": backend_pid},
                        )
                    )

                async with asyncio.timeout(5):
                    while not await waiting_on_lock():
                        await asyncio.sleep(0.01)

            await CoachInvitationService(revoker).revoke(coach_id, invitation.id)
            with pytest.raises(CoachInvitationRevoked):
                await accept_task


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgres_accept_pair_integrity_error_rolls_back_cleanly(db_session: AsyncSession, monkeypatch):
    from app.infrastructure.repositories.coach_repository import CoachClientRepository

    coach_id, client_id = await _users(db_session, 819031, 819032)
    first_token, second_token = "postgres-pair-race-1", "postgres-pair-race-2"
    await _invitation(db_session, coach_id, first_token)
    await _invitation(db_session, coach_id, second_token)
    sessions = async_sessionmaker(db_session.bind, class_=AsyncSession, expire_on_commit=False)

    original_get = CoachClientRepository.get_for_coach
    both_checked = asyncio.Event()
    checked_count = 0

    async def synchronize_pair_check(repository, *args, **kwargs):
        nonlocal checked_count
        result = await original_get(repository, *args, **kwargs)
        checked_count += 1
        if checked_count == 2:
            both_checked.set()
        await both_checked.wait()
        return result

    monkeypatch.setattr(CoachClientRepository, "get_for_coach", synchronize_pair_check)
    open_sessions: list[AsyncSession] = []

    async def accept(token: str):
        session = sessions()
        open_sessions.append(session)
        return await CoachInvitationService(session).accept(client_id, token)

    try:
        outcomes = await asyncio.gather(
            accept(first_token), accept(second_token), return_exceptions=True
        )
        successes = [outcome for outcome in outcomes if not isinstance(outcome, Exception)]
        failures = [outcome for outcome in outcomes if isinstance(outcome, Exception)]
        assert len(successes) == 1
        assert len(failures) == 1 and isinstance(failures[0], CoachClientAlreadyExists)
        for session in open_sessions:
            assert await session.scalar(select(1)) == 1
    finally:
        for session in open_sessions:
            await session.close()
