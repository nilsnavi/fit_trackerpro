"""
Achievements API Router
Endpoints for achievements and user progress
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, Achievement, UserAchievement
from app.schemas.achievements import (
    AchievementResponse,
    AchievementListResponse,
    UserAchievementResponse,
    UserAchievementListResponse,
    AchievementUnlockResponse,
)

router = APIRouter()


@router.get("/", response_model=AchievementListResponse)
async def get_achievements(
    category: Optional[str] = Query(
        None, pattern="^(workouts|health|streaks|social|general)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of all available achievements

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `category`: Filter by category (workouts, health, streaks, social, general)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "code": "first_workout",
                "name": "First Steps",
                "description": "Complete your first workout",
                "icon_url": "https://...",
                "condition": {"type": "workout_count", "value": 1},
                "points": 10,
                "category": "workouts",
                "is_hidden": false,
                "display_order": 1,
                "created_at": "2024-01-01T00:00:00"
            }
        ],
        "total": 25,
        "categories": ["workouts", "health", "streaks", "social", "general"]
    }
    ```
    """
    # Build query
    query = select(Achievement)

    if category:
        query = query.where(Achievement.category == category)

    # Order by display_order
    query = query.order_by(Achievement.display_order, Achievement.category)

    result = await db.execute(query)
    achievements = result.scalars().all()

    # Get unique categories
    categories_result = await db.execute(
        select(Achievement.category).distinct()
    )
    categories = [c[0] for c in categories_result.all()]

    return AchievementListResponse(
        items=achievements,
        total=len(achievements),
        categories=categories
    )


@router.get("/user", response_model=UserAchievementListResponse)
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get current user's achievements

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "user_id": 1,
                "achievement_id": 1,
                "achievement": {...},
                "earned_at": "2024-01-15T10:30:00",
                "progress": 100,
                "progress_data": {},
                "is_completed": true
            }
        ],
        "total": 5,
        "total_points": 150,
        "completed_count": 5,
        "in_progress_count": 3,
        "recent_achievements": [...]
    }
    ```
    """
    # Get user's achievements with achievement details
    result = await db.execute(
        select(UserAchievement, Achievement)
        .join(Achievement, UserAchievement.achievement_id == Achievement.id)
        .where(UserAchievement.user_id == current_user.id)
        .order_by(desc(UserAchievement.earned_at))
    )
    user_achievements = result.all()

    # Build response items
    items = []
    total_points = 0
    completed_count = 0
    in_progress_count = 0

    for ua, achievement in user_achievements:
        is_completed = ua.progress >= 100
        if is_completed:
            completed_count += 1
            total_points += achievement.points
        else:
            in_progress_count += 1

        items.append(UserAchievementResponse(
            id=ua.id,
            user_id=ua.user_id,
            achievement_id=ua.achievement_id,
            achievement=achievement,
            earned_at=ua.earned_at,
            progress=ua.progress,
            progress_data=ua.progress_data,
            is_completed=is_completed
        ))

    # Recent achievements (last 5 completed)
    recent = [i for i in items if i.is_completed][:5]

    return UserAchievementListResponse(
        items=items,
        total=len(items),
        total_points=total_points,
        completed_count=completed_count,
        in_progress_count=in_progress_count,
        recent_achievements=recent
    )


@router.get("/user/{achievement_id}", response_model=UserAchievementResponse)
async def get_user_achievement_detail(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific user achievement details
    """
    result = await db.execute(
        select(UserAchievement, Achievement)
        .join(Achievement, UserAchievement.achievement_id == Achievement.id)
        .where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id == achievement_id
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )

    ua, achievement = row
    is_completed = ua.progress >= 100

    return UserAchievementResponse(
        id=ua.id,
        user_id=ua.user_id,
        achievement_id=ua.achievement_id,
        achievement=achievement,
        earned_at=ua.earned_at,
        progress=ua.progress,
        progress_data=ua.progress_data,
        is_completed=is_completed
    )


@router.post("/{achievement_id}/claim", response_model=AchievementUnlockResponse)
async def claim_achievement(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Claim an achievement (if criteria met)

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "unlocked": true,
        "achievement": {...},
        "points_earned": 50,
        "new_total_points": 200,
        "message": "Achievement unlocked! Keep up the great work!"
    }
    ```
    """
    # Get achievement
    result = await db.execute(
        select(Achievement).where(Achievement.id == achievement_id)
    )
    achievement = result.scalar_one_or_none()

    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )

    # Check if already claimed
    result = await db.execute(
        select(UserAchievement).where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id == achievement_id
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing and existing.progress >= 100:
        return AchievementUnlockResponse(
            unlocked=False,
            achievement=achievement,
            points_earned=0,
            new_total_points=0,
            message="Achievement already unlocked"
        )

    # TODO: Check if criteria are met
    # For now, auto-claim for demonstration

    if existing:
        existing.progress = 100
        existing.earned_at = datetime.utcnow()
    else:
        existing = UserAchievement(
            user_id=current_user.id,
            achievement_id=achievement_id,
            progress=100,
            earned_at=datetime.utcnow()
        )
        db.add(existing)

    await db.commit()

    # Calculate new total points
    total_result = await db.execute(
        select(func.sum(Achievement.points))
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.progress >= 100
            )
        )
    )
    total_points = total_result.scalar() or 0

    return AchievementUnlockResponse(
        unlocked=True,
        achievement=achievement,
        points_earned=achievement.points,
        new_total_points=total_points,
        message=f"Achievement unlocked! {achievement.description}"
    )


@router.get("/leaderboard")
async def get_achievements_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get achievements leaderboard

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "leaderboard": [
            {
                "rank": 1,
                "user_id": 123,
                "username": "fitness_pro",
                "total_points": 1250,
                "achievements_count": 25
            }
        ],
        "user_rank": 15,
        "total_users": 500
    }
    ```
    """
    # Get top users by points
    result = await db.execute(
        select(
            UserAchievement.user_id,
            func.sum(Achievement.points).label("total_points"),
            func.count(UserAchievement.id).label("achievements_count")
        )
        .join(Achievement, UserAchievement.achievement_id == Achievement.id)
        .where(UserAchievement.progress >= 100)
        .group_by(UserAchievement.user_id)
        .order_by(desc("total_points"))
        .limit(limit)
    )
    top_users = result.all()

    # Build leaderboard
    leaderboard = []
    for rank, row in enumerate(top_users, 1):
        # Get user info
        user_result = await db.execute(
            select(User).where(User.id == row.user_id)
        )
        user = user_result.scalar_one_or_none()

        leaderboard.append({
            "rank": rank,
            "user_id": row.user_id,
            "username": user.username if user else None,
            "first_name": user.first_name if user else None,
            "total_points": row.total_points,
            "achievements_count": row.achievements_count
        })

    # Get user's rank
    user_rank_result = await db.execute(
        select(
            func.sum(Achievement.points).label("user_points")
        )
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .where(
            and_(
                UserAchievement.user_id == current_user.id,
                UserAchievement.progress >= 100
            )
        )
    )
    user_points = user_rank_result.scalar() or 0

    # Count users with more points
    higher_ranked = await db.execute(
        select(func.count()).select_from(
            select(UserAchievement.user_id)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .where(UserAchievement.progress >= 100)
            .group_by(UserAchievement.user_id)
            .having(func.sum(Achievement.points) > user_points)
            .subquery()
        )
    )
    user_rank = higher_ranked.scalar() + 1

    # Total users
    total_users_result = await db.execute(
        select(func.count()).select_from(
            select(UserAchievement.user_id)
            .distinct()
            .subquery()
        )
    )
    total_users = total_users_result.scalar()

    return {
        "leaderboard": leaderboard,
        "user_rank": user_rank,
        "user_points": user_points,
        "total_users": total_users
    }
