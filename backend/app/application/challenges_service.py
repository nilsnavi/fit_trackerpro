from __future__ import annotations

import secrets
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import CHALLENGE_CREATE, audit_log
from app.domain.challenge import Challenge
from app.domain.exceptions import (
    ChallengeNotFoundError,
    ChallengeValidationError,
    NotImplementedFeatureError,
)
from app.infrastructure.repositories.challenges_repository import ChallengesRepository
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeDetailResponse,
    ChallengeJoinResponse,
    ChallengeLeaderboardResponse,
    ChallengeLeaveResponse,
    ChallengeListFilters,
    ChallengeListResponse,
    ChallengeMyActiveResponse,
    ChallengeResponse,
)

CHALLENGE_PARTICIPATION_NOT_IMPLEMENTED = (
    "Challenge participation (join, leave, leaderboard) is not implemented yet"
)


class ChallengesService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = ChallengesRepository(db)

    @staticmethod
    def _generate_join_code() -> str:
        return secrets.token_urlsafe(8)[:10].upper()

    async def get_challenges(
        self,
        status: str | None,
        challenge_type: str | None,
        is_public: bool | None,
        page: int,
        page_size: int,
        creator_id: int | None = None,
    ) -> ChallengeListResponse:
        total = await self.repository.count_challenges(
            status, challenge_type, is_public, creator_id=creator_id
        )
        challenges = await self.repository.list_challenges(
            status, challenge_type, is_public, page, page_size, creator_id=creator_id
        )

        items = []
        for challenge in challenges:
            creator = await self.repository.get_user(challenge.creator_id)
            items.append(
                ChallengeResponse(
                    id=challenge.id,
                    creator_id=challenge.creator_id,
                    creator_name=creator.first_name if creator else None,
                    name=challenge.name,
                    description=challenge.description,
                    type=challenge.type,
                    goal=challenge.goal,
                    start_date=challenge.start_date,
                    end_date=challenge.end_date,
                    is_public=challenge.is_public,
                    join_code=challenge.join_code,
                    max_participants=challenge.max_participants,
                    current_participants=0,
                    rules=challenge.rules,
                    banner_url=challenge.banner_url,
                    status=challenge.status,
                    created_at=challenge.created_at,
                    updated_at=challenge.updated_at,
                )
            )
        return ChallengeListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            filters=ChallengeListFilters(
                status=status,
                type=challenge_type,
                is_public=is_public,
                mine=creator_id is not None,
            ),
        )

    async def get_challenge(self, challenge_id: int) -> ChallengeDetailResponse:
        challenge = await self.repository.get_challenge(challenge_id)
        if not challenge:
            raise ChallengeNotFoundError("Challenge not found")
        creator = await self.repository.get_user(challenge.creator_id)
        participants = []
        return ChallengeDetailResponse(
            id=challenge.id,
            creator_id=challenge.creator_id,
            creator_name=creator.first_name if creator else None,
            name=challenge.name,
            description=challenge.description,
            type=challenge.type,
            goal=challenge.goal,
            start_date=challenge.start_date,
            end_date=challenge.end_date,
            is_public=challenge.is_public,
            join_code=challenge.join_code,
            max_participants=challenge.max_participants,
            current_participants=len(participants),
            rules=challenge.rules,
            banner_url=challenge.banner_url,
            status=challenge.status,
            created_at=challenge.created_at,
            updated_at=challenge.updated_at,
            participants=participants,
            user_progress=None,
            user_rank=None,
        )

    async def create_challenge(
        self,
        user_id: int,
        user_first_name: str | None,
        data: ChallengeCreate,
        client_ip: str | None = None,
    ) -> ChallengeResponse:
        if data.end_date <= data.start_date:
            raise ChallengeValidationError("End date must be after start date")

        today = date.today()
        if data.start_date > today:
            challenge_status = "upcoming"
        elif data.end_date < today:
            challenge_status = "completed"
        else:
            challenge_status = "active"

        join_code = None if data.is_public else self._generate_join_code()

        challenge = Challenge(
            creator_id=user_id,
            name=data.name,
            description=data.description,
            type=data.type,
            goal=data.goal.model_dump(),
            start_date=data.start_date,
            end_date=data.end_date,
            is_public=data.is_public,
            join_code=join_code,
            max_participants=data.max_participants,
            rules=data.rules.model_dump(),
            banner_url=data.banner_url,
            status=challenge_status,
        )
        challenge = await self.repository.create_challenge(challenge)

        audit_log(
            action=CHALLENGE_CREATE,
            user_db_id=user_id,
            resource_type="challenge",
            resource_id=challenge.id,
            client_ip=client_ip,
            meta={"is_public": data.is_public, "status": challenge_status},
        )

        return ChallengeResponse(
            id=challenge.id,
            creator_id=challenge.creator_id,
            creator_name=user_first_name,
            name=challenge.name,
            description=challenge.description,
            type=challenge.type,
            goal=challenge.goal,
            start_date=challenge.start_date,
            end_date=challenge.end_date,
            is_public=challenge.is_public,
            join_code=challenge.join_code,
            max_participants=challenge.max_participants,
            current_participants=0,
            rules=challenge.rules,
            banner_url=challenge.banner_url,
            status=challenge.status,
            created_at=challenge.created_at,
            updated_at=challenge.updated_at,
        )

    # ------------------------------------------------------------------
    # Participation is not implemented: there is no participants table and no
    # progress tracking. The endpoints used to answer "joined!" with a made-up
    # participant count, empty leaderboards and nothing persisted. Until the
    # feature is built they honestly answer 501 (same approach as coach access).
    # ------------------------------------------------------------------
    async def join_challenge(
        self,
        user_id: int,
        challenge_id: int,
        join_code: str | None,
        client_ip: str | None = None,
    ) -> ChallengeJoinResponse:
        _ = (user_id, challenge_id, join_code, client_ip)
        raise NotImplementedFeatureError(CHALLENGE_PARTICIPATION_NOT_IMPLEMENTED)

    async def leave_challenge(
        self,
        user_id: int,
        challenge_id: int,
        client_ip: str | None = None,
    ) -> ChallengeLeaveResponse:
        _ = (user_id, challenge_id, client_ip)
        raise NotImplementedFeatureError(CHALLENGE_PARTICIPATION_NOT_IMPLEMENTED)

    async def get_challenge_leaderboard(self, challenge_id: int) -> ChallengeLeaderboardResponse:
        _ = challenge_id
        raise NotImplementedFeatureError(CHALLENGE_PARTICIPATION_NOT_IMPLEMENTED)

    async def get_my_active_challenges(self, user_id: int) -> ChallengeMyActiveResponse:
        _ = user_id
        raise NotImplementedFeatureError(CHALLENGE_PARTICIPATION_NOT_IMPLEMENTED)
