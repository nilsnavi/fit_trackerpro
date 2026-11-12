from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select, update

from app.domain.refresh_session import RefreshSession
from app.infrastructure.repositories.base import SQLAlchemyRepository


class RefreshSessionRepository(SQLAlchemyRepository):
    async def create(self, session: RefreshSession) -> RefreshSession:
        self.add(session)
        await self.commit()
        await self.refresh(session)
        return session

    async def get_by_jti(self, jti: str) -> RefreshSession | None:
        return await self.db.scalar(
            select(RefreshSession).where(RefreshSession.jti == jti)
        )

    async def revoke(
        self, session: RefreshSession, *, replaced_by_jti: str | None = None
    ) -> None:
        session.revoked_at = datetime.now(UTC)
        if replaced_by_jti:
            session.replaced_by_jti = replaced_by_jti
        await self.commit()

    async def revoke_if_active(
        self, jti: str, *, replaced_by_jti: str, now: datetime | None = None
    ) -> bool:
        """Atomically claim a session for rotation.

        Returns ``True`` only when this caller revoked the still-active row; a
        concurrent refresh that already rotated it gets ``False`` and must treat
        the token as reused.
        """
        result = await self.db.execute(
            update(RefreshSession)
            .where(
                RefreshSession.jti == jti,
                RefreshSession.revoked_at.is_(None),
            )
            .values(
                revoked_at=now or datetime.now(UTC),
                replaced_by_jti=replaced_by_jti,
            )
            .execution_options(synchronize_session=False)
        )
        await self.commit()
        return (result.rowcount or 0) == 1

    async def revoke_family(
        self, user_id: int, family_id: str, *, now: datetime | None = None
    ) -> int:
        result = await self.db.execute(
            update(RefreshSession)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.family_id == family_id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=now or datetime.now(UTC))
            .execution_options(synchronize_session=False)
        )
        await self.commit()
        return result.rowcount or 0

    async def revoke_all_for_user(
        self, user_id: int, *, now: datetime | None = None
    ) -> int:
        result = await self.db.execute(
            update(RefreshSession)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=now or datetime.now(UTC))
            .execution_options(synchronize_session=False)
        )
        await self.commit()
        return result.rowcount or 0

    async def delete_expired(self, *, now: datetime | None = None) -> int:
        result = await self.db.execute(
            delete(RefreshSession).where(
                RefreshSession.expires_at < (now or datetime.now(UTC))
            ).execution_options(synchronize_session=False)
        )
        await self.commit()
        return result.rowcount or 0