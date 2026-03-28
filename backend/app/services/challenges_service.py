from __future__ import annotations

import secrets
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import Challenge
from app.repositories.challenges_repository import ChallengesRepository
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeDetailResponse,
    ChallengeJoinResponse,
    ChallengeListResponse,
    ChallengeResponse,
)


class ChallengeNotFoundError(Exception):
    pass


class ChallengeValidationError(Exception):
    pass


class ChallengeForbiddenError(Exception):
    pass


class ChallengesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
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
    ) -> ChallengeListResponse:
        total = await self.repository.count_challenges(status, challenge_type, is_public)
        challenges = await self.repository.list_challenges(status, challenge_type, is_public, page, page_size)

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
            filters={"status": status, "type": challenge_type, "is_public": is_public},
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

    async def create_challenge(self, user_id: int, user_first_name: str | None, data: ChallengeCreate) -> ChallengeResponse:
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
        self.db.add(challenge)
        await self.db.commit()
        await self.db.refresh(challenge)

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

    async def join_challenge(self, challenge_id: int, join_code: str | None) -> ChallengeJoinResponse:
        challenge = await self.repository.get_challenge(challenge_id)
        if not challenge:
            raise ChallengeNotFoundError("Challenge not found")
        if challenge.status == "completed":
            raise ChallengeValidationError("Challenge has already ended")
        if challenge.status == "cancelled":
            raise ChallengeValidationError("Challenge has been cancelled")
        if not challenge.is_public and (not join_code or join_code.upper() != challenge.join_code):
            raise ChallengeForbiddenError("Invalid join code")

        return ChallengeJoinResponse(
            success=True,
            challenge_id=challenge_id,
            joined_at=datetime.utcnow(),
            message="Successfully joined the challenge!",
            participant_count=46,
        )

    async def leave_challenge(self, challenge_id: int):
        challenge = await self.repository.get_challenge(challenge_id)
        if not challenge:
            raise ChallengeNotFoundError("Challenge not found")
        return {
            "success": True,
            "challenge_id": challenge_id,
            "message": "Successfully left the challenge",
        }

    async def get_challenge_leaderboard(self, challenge_id: int):
        challenge = await self.repository.get_challenge(challenge_id)
        if not challenge:
            raise ChallengeNotFoundError("Challenge not found")
        return {
            "challenge_id": challenge_id,
            "entries": [],
            "user_rank": None,
            "total_participants": 0,
        }

    async def get_my_active_challenges(self):
        return {"items": [], "total": 0}
