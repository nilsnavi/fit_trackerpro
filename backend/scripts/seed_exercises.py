"""
Seed a minimal system exercise catalog when the database has very few active rows.

Run from the `backend` directory:

    python -m scripts.seed_exercises

Requires DATABASE_URL (same as the FastAPI app).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sqlalchemy import func, select

# Allow `python -m scripts.seed_exercises` with cwd = backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.domain.exercise import Exercise  # noqa: E402
from app.infrastructure.database import AsyncSessionLocal  # noqa: E402

_MIN_ACTIVE = 20

_DEFAULT_RISK_FLAGS: dict[str, bool] = {
    "high_blood_pressure": False,
    "diabetes": False,
    "joint_problems": False,
    "back_problems": False,
    "heart_conditions": False,
}

_SEED_ROWS: list[dict[str, object]] = [
    {
        "slug": "seed-bench-press",
        "name": "Bench Press",
        "description": "Horizontal barbell press for chest and triceps.",
        "category": "strength",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["chest", "triceps", "shoulders"],
    },
    {
        "slug": "seed-incline-db-press",
        "name": "Incline Dumbbell Press",
        "description": "Upper chest emphasis on an incline bench.",
        "category": "strength",
        "equipment": ["dumbbells", "bench"],
        "muscle_groups": ["chest", "shoulders", "triceps"],
    },
    {
        "slug": "seed-dips",
        "name": "Parallel Bar Dips",
        "description": "Bodyweight pressing for chest and triceps.",
        "category": "strength",
        "equipment": ["dip_station"],
        "muscle_groups": ["chest", "triceps"],
    },
    {
        "slug": "seed-back-squat",
        "name": "Back Squat",
        "description": "Barbell squat with bar on upper back.",
        "category": "strength",
        "equipment": ["barbell", "rack"],
        "muscle_groups": ["quadriceps", "glutes", "hamstrings"],
    },
    {
        "slug": "seed-front-squat",
        "name": "Front Squat",
        "description": "Squat with barbell in front rack position.",
        "category": "strength",
        "equipment": ["barbell", "rack"],
        "muscle_groups": ["quadriceps", "glutes", "core"],
    },
    {
        "slug": "seed-romanian-deadlift",
        "name": "Romanian Deadlift",
        "description": "Hip hinge with emphasis on hamstrings and glutes.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["hamstrings", "glutes", "lower_back"],
    },
    {
        "slug": "seed-leg-press",
        "name": "Leg Press",
        "description": "Machine-based compound leg movement.",
        "category": "strength",
        "equipment": ["leg_press_machine"],
        "muscle_groups": ["quadriceps", "glutes"],
    },
    {
        "slug": "seed-lunge-walk",
        "name": "Walking Lunge",
        "description": "Alternating forward lunges while walking.",
        "category": "strength",
        "equipment": ["dumbbells"],
        "muscle_groups": ["quadriceps", "glutes"],
    },
    {
        "slug": "seed-pull-up",
        "name": "Pull-up",
        "description": "Vertical pull with pronated grip.",
        "category": "strength",
        "equipment": ["pull_up_bar"],
        "muscle_groups": ["lats", "biceps", "back"],
    },
    {
        "slug": "seed-barbell-row",
        "name": "Barbell Row",
        "description": "Bent-over horizontal pull for mid-back.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["back", "biceps", "traps"],
    },
    {
        "slug": "seed-cable-row",
        "name": "Seated Cable Row",
        "description": "Machine row for mid-back thickness.",
        "category": "strength",
        "equipment": ["cable_machine"],
        "muscle_groups": ["back", "biceps"],
    },
    {
        "slug": "seed-face-pull",
        "name": "Face Pull",
        "description": "Rear delt and external rotation on cable.",
        "category": "strength",
        "equipment": ["cable_machine", "rope_attachment"],
        "muscle_groups": ["shoulders", "back"],
    },
    {
        "slug": "seed-ohp",
        "name": "Overhead Press",
        "description": "Standing barbell press overhead.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["shoulders", "triceps", "traps"],
    },
    {
        "slug": "seed-lateral-raise",
        "name": "Dumbbell Lateral Raise",
        "description": "Isolation for medial deltoids.",
        "category": "strength",
        "equipment": ["dumbbells"],
        "muscle_groups": ["shoulders"],
    },
    {
        "slug": "seed-barbell-curl",
        "name": "Barbell Curl",
        "description": "Classic biceps curl with a barbell.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["biceps", "forearms"],
    },
    {
        "slug": "seed-tricep-pushdown",
        "name": "Tricep Pushdown",
        "description": "Cable extension for triceps.",
        "category": "strength",
        "equipment": ["cable_machine"],
        "muscle_groups": ["triceps"],
    },
    {
        "slug": "seed-plank",
        "name": "Plank",
        "description": "Isometric core hold.",
        "category": "strength",
        "equipment": [],
        "muscle_groups": ["core"],
    },
    {
        "slug": "seed-dead-bug",
        "name": "Dead Bug",
        "description": "Supine anti-extension core drill.",
        "category": "strength",
        "equipment": [],
        "muscle_groups": ["core"],
    },
    {
        "slug": "seed-treadmill-run",
        "name": "Treadmill Run",
        "description": "Steady or interval running indoors.",
        "category": "cardio",
        "equipment": ["treadmill"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-bike-erg",
        "name": "Assault Bike",
        "description": "Full-body air bike intervals.",
        "category": "cardio",
        "equipment": ["assault_bike"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-rower",
        "name": "Rowing Machine",
        "description": "Full-body cardio on a row erg.",
        "category": "cardio",
        "equipment": ["rowing_machine"],
        "muscle_groups": ["full_body", "back"],
    },
    {
        "slug": "seed-jump-rope",
        "name": "Jump Rope",
        "description": "Lightweight conditioning and coordination.",
        "category": "cardio",
        "equipment": ["jump_rope"],
        "muscle_groups": ["calves", "full_body"],
    },
    {
        "slug": "seed-yoga-flow",
        "name": "Yoga Flow",
        "description": "Mobility and balance sequence.",
        "category": "flexibility",
        "equipment": ["yoga_mat"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-hamstring-stretch",
        "name": "Seated Hamstring Stretch",
        "description": "Passive stretch for posterior chain.",
        "category": "flexibility",
        "equipment": [],
        "muscle_groups": ["hamstrings"],
    },
    {
        "slug": "seed-kettlebell-swing",
        "name": "Kettlebell Swing",
        "description": "Hip power and conditioning.",
        "category": "sport",
        "equipment": ["kettlebell"],
        "muscle_groups": ["glutes", "hamstrings", "core"],
    },
    {
        "slug": "seed-sled-push",
        "name": "Sled Push",
        "description": "Heavy lower-body power and conditioning.",
        "category": "sport",
        "equipment": ["sled"],
        "muscle_groups": ["quadriceps", "glutes", "calves"],
    },
]


async def _count_active(session) -> int:
    result = await session.execute(select(func.count()).select_from(Exercise).where(Exercise.status == "active"))
    return int(result.scalar() or 0)


async def _existing_slugs(session) -> set[str]:
    rows = (await session.execute(select(Exercise.slug).where(Exercise.slug.is_not(None)))).scalars().all()
    return {s for s in rows if s}


async def seed_if_needed() -> int:
    async with AsyncSessionLocal() as session:
        active = await _count_active(session)
        if active >= _MIN_ACTIVE:
            print(f"Skipping seed: already {active} active exercises (threshold {_MIN_ACTIVE}).")
            return 0

        existing = await _existing_slugs(session)
        created = 0
        for row in _SEED_ROWS:
            slug = str(row["slug"])
            if slug in existing:
                continue
            muscle_groups = list(row["muscle_groups"])  # type: ignore[arg-type]
            equipment = list(row["equipment"])  # type: ignore[arg-type]
            exercise = Exercise(
                slug=slug,
                name=str(row["name"]),
                description=str(row["description"]) if row.get("description") else None,
                category=str(row["category"]),
                equipment=equipment,
                muscle_groups=muscle_groups,
                muscle_group=muscle_groups[0] if muscle_groups else None,
                aliases=[],
                risk_flags=dict(_DEFAULT_RISK_FLAGS),
                media_url=None,
                status="active",
                source="system",
                author_user_id=None,
            )
            session.add(exercise)
            created += 1

        if created:
            await session.commit()
        else:
            await session.rollback()

        print(f"Seeded {created} exercises (active before: {active}).")
        return created


def main() -> None:
    asyncio.run(seed_if_needed())


if __name__ == "__main__":
    main()
