"""
Challenges API Router
Endpoints for fitness challenges
"""
from typing import Optional, List
from datetime import datetime, date, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, Challenge
from app.schemas.challenges import (
    ChallengeCreate,
    ChallengeResponse,
    ChallengeListResponse,
    ChallengeJoinResponse,
    ChallengeDetailResponse,
    ChallengeParticipant,
)

router = APIRouter()


def generate_join_code() -> str:
    """Generate a random join code"""
    return secrets.token_urlsafe(8)[:10].upper()


@router.get("/", response_model=ChallengeListResponse)
async def get_challenges(
    status: Optional[str] = Query(
        None, pattern="^(upcoming|active|completed|cancelled)$"),
    challenge_type: Optional[str] = Query(
        None,
        pattern="^(workout_count|duration|calories|distance|custom)$"
    ),
    is_public: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of challenges

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `status`: Filter by status (upcoming, active, completed, cancelled)
    - `type`: Filter by type (workout_count, duration, calories, distance, custom)
    - `is_public`: Filter by visibility
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "creator_id": 1,
                "creator_name": "John",
                "name": "30-Day Strength Challenge",
                "description": "Complete 20 workouts in 30 days",
                "type": "workout_count",
                "goal": {"type": "count", "target": 20, "unit": "workouts"},
                "start_date": "2024-02-01",
                "end_date": "2024-03-02",
                "is_public": true,
                "join_code": null,
                "max_participants": 100,
                "current_participants": 45,
                "rules": {},
                "banner_url": "https://...",
                "status": "upcoming",
                "created_at": "2024-01-15T10:00:00",
                "updated_at": "2024-01-15T10:00:00"
            }
        ],
        "total": 10,
        "page": 1,
        "page_size": 20,
        "filters": {"status": "upcoming"}
    }
    ```
    """
    # Build query
    query = select(Challenge)

    # Apply filters
    if status:
        query = query.where(Challenge.status == status)

    if challenge_type:
        query = query.where(Challenge.type == challenge_type)

    if is_public is not None:
        query = query.where(Challenge.is_public == is_public)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.order_by(desc(Challenge.start_date))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    challenges = result.scalars().all()

    # Enrich with creator names
    challenge_responses = []
    for c in challenges:
        creator_result = await db.execute(
            select(User).where(User.id == c.creator_id)
        )
        creator = creator_result.scalar_one_or_none()

        challenge_dict = {
            "id": c.id,
            "creator_id": c.creator_id,
            "creator_name": creator.first_name if creator else None,
            "name": c.name,
            "description": c.description,
            "type": c.type,
            "goal": c.goal,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "is_public": c.is_public,
            "join_code": c.join_code,
            "max_participants": c.max_participants,
            "current_participants": 0,  # TODO: Calculate from participants table
            "rules": c.rules,
            "banner_url": c.banner_url,
            "status": c.status,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        }
        challenge_responses.append(ChallengeResponse(**challenge_dict))

    return ChallengeListResponse(
        items=challenge_responses,
        total=total,
        page=page,
        page_size=page_size,
        filters={
            "status": status,
            "type": challenge_type,
            "is_public": is_public
        }
    )


@router.get("/{challenge_id}", response_model=ChallengeDetailResponse)
async def get_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get challenge details by ID
    """
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    # Get creator info
    creator_result = await db.execute(
        select(User).where(User.id == challenge.creator_id)
    )
    creator = creator_result.scalar_one_or_none()

    # TODO: Get participants list
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
        user_rank=None
    )


@router.post("/", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    challenge_data: ChallengeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create new challenge

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "name": "30-Day Strength Challenge",
        "description": "Complete 20 workouts in 30 days",
        "type": "workout_count",
        "goal": {
            "type": "count",
            "target": 20,
            "unit": "workouts",
            "description": "Complete 20 workouts"
        },
        "start_date": "2024-02-01",
        "end_date": "2024-03-02",
        "is_public": true,
        "max_participants": 100,
        "rules": {
            "min_workouts_per_week": 3
        },
        "banner_url": "https://..."
    }
    ```

    **Response:** Created challenge
    """
    # Validate dates
    if challenge_data.end_date <= challenge_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )

    # Determine status based on dates
    today = date.today()
    if challenge_data.start_date > today:
        status = "upcoming"
    elif challenge_data.end_date < today:
        status = "completed"
    else:
        status = "active"

    # Generate join code for private challenges
    join_code = None
    if not challenge_data.is_public:
        join_code = generate_join_code()

    challenge = Challenge(
        creator_id=current_user.id,
        name=challenge_data.name,
        description=challenge_data.description,
        type=challenge_data.type,
        goal=challenge_data.goal.model_dump(),
        start_date=challenge_data.start_date,
        end_date=challenge_data.end_date,
        is_public=challenge_data.is_public,
        join_code=join_code,
        max_participants=challenge_data.max_participants,
        rules=challenge_data.rules.model_dump(),
        banner_url=challenge_data.banner_url,
        status=status
    )

    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)

    return ChallengeResponse(
        id=challenge.id,
        creator_id=challenge.creator_id,
        creator_name=current_user.first_name,
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
        updated_at=challenge.updated_at
    )


@router.post("/{challenge_id}/join", response_model=ChallengeJoinResponse)
async def join_challenge(
    challenge_id: int,
    join_code: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Join a challenge

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "join_code": "ABC123XYZ"  // Required for private challenges
    }
    ```

    **Response:**
    ```json
    {
        "success": true,
        "challenge_id": 1,
        "joined_at": "2024-01-20T10:00:00",
        "message": "Successfully joined the challenge!",
        "participant_count": 46
    }
    ```
    """
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    # Check if challenge is active/upcoming
    if challenge.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge has already ended"
        )

    if challenge.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge has been cancelled"
        )

    # Check join code for private challenges
    if not challenge.is_public:
        if not join_code or join_code.upper() != challenge.join_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid join code"
            )

    # Check max participants
    # TODO: Check actual participant count from participants table

    # TODO: Add user to challenge participants
    # For now, return success

    return ChallengeJoinResponse(
        success=True,
        challenge_id=challenge_id,
        joined_at=datetime.utcnow(),
        message="Successfully joined the challenge!",
        participant_count=46  # TODO: Get actual count
    )


@router.post("/{challenge_id}/leave")
async def leave_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Leave a challenge
    """
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    # TODO: Remove user from challenge participants

    return {
        "success": True,
        "challenge_id": challenge_id,
        "message": "Successfully left the challenge"
    }


@router.get("/{challenge_id}/leaderboard")
async def get_challenge_leaderboard(
    challenge_id: int,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get challenge leaderboard

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "challenge_id": 1,
        "entries": [
            {
                "rank": 1,
                "user_id": 123,
                "username": "fitness_pro",
                "first_name": "John",
                "progress": 18,
                "completion_percentage": 90.0,
                "last_activity": "2024-01-19T15:00:00"
            }
        ],
        "user_rank": 5,
        "total_participants": 46
    }
    ```
    """
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    # TODO: Get actual leaderboard data from participants table
    # For now, return empty placeholder

    return {
        "challenge_id": challenge_id,
        "entries": [],
        "user_rank": None,
        "total_participants": 0
    }


@router.get("/my/active")
async def get_my_active_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get current user's active challenges
    """
    # TODO: Get challenges where user is a participant and status is active/upcoming

    return {
        "items": [],
        "total": 0
    }
