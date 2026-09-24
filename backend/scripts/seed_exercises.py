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
        "name": "Жим штанги лежа",
        "description": "Горизонтальный жим штанги для груди и трицепсов.",
        "category": "strength",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["chest", "triceps", "shoulders"],
    },
    {
        "slug": "seed-incline-db-press",
        "name": "Жим гантелей на наклонной скамье",
        "description": "Жим на наклонной скамье с акцентом на верх груди.",
        "category": "strength",
        "equipment": ["dumbbells", "bench"],
        "muscle_groups": ["chest", "shoulders", "triceps"],
    },
    {
        "slug": "seed-dips",
        "name": "Отжимания на брусьях",
        "description": "Жимовое упражнение с собственным весом для груди и трицепсов.",
        "category": "strength",
        "equipment": ["dip_station"],
        "muscle_groups": ["chest", "triceps"],
    },
    {
        "slug": "seed-back-squat",
        "name": "Приседание со штангой на спине",
        "description": "Приседание со штангой, расположенной на верхней части спины.",
        "category": "strength",
        "equipment": ["barbell", "rack"],
        "muscle_groups": ["quadriceps", "glutes", "hamstrings"],
    },
    {
        "slug": "seed-front-squat",
        "name": "Фронтальное приседание",
        "description": "Приседание со штангой в переднем положении.",
        "category": "strength",
        "equipment": ["barbell", "rack"],
        "muscle_groups": ["quadriceps", "glutes", "core"],
    },
    {
        "slug": "seed-romanian-deadlift",
        "name": "Румынская тяга",
        "description": "Движение через тазобедренный шарнир с акцентом на заднюю поверхность бедра и ягодицы.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["hamstrings", "glutes", "lower_back"],
    },
    {
        "slug": "seed-leg-press",
        "name": "Жим ногами",
        "description": "Базовое упражнение для ног в тренажере.",
        "category": "strength",
        "equipment": ["leg_press_machine"],
        "muscle_groups": ["quadriceps", "glutes"],
    },
    {
        "slug": "seed-lunge-walk",
        "name": "Выпады в ходьбе",
        "description": "Попеременные выпады вперед в движении.",
        "category": "strength",
        "equipment": ["dumbbells"],
        "muscle_groups": ["quadriceps", "glutes"],
    },
    {
        "slug": "seed-pull-up",
        "name": "Подтягивание",
        "description": "Вертикальная тяга прямым хватом.",
        "category": "strength",
        "equipment": ["pull_up_bar"],
        "muscle_groups": ["lats", "biceps", "back"],
    },
    {
        "slug": "seed-barbell-row",
        "name": "Тяга штанги в наклоне",
        "description": "Горизонтальная тяга в наклоне для середины спины.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["back", "biceps", "traps"],
    },
    {
        "slug": "seed-cable-row",
        "name": "Тяга горизонтального блока сидя",
        "description": "Тяга в тренажере для развития середины спины.",
        "category": "strength",
        "equipment": ["cable_machine"],
        "muscle_groups": ["back", "biceps"],
    },
    {
        "slug": "seed-face-pull",
        "name": "Тяга каната к лицу",
        "description": "Упражнение на задние дельты и наружную ротацию плеча в блоке.",
        "category": "strength",
        "equipment": ["cable_machine", "rope_attachment"],
        "muscle_groups": ["shoulders", "back"],
    },
    {
        "slug": "seed-ohp",
        "name": "Жим штанги над головой",
        "description": "Жим штанги стоя над головой.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["shoulders", "triceps", "traps"],
    },
    {
        "slug": "seed-lateral-raise",
        "name": "Разведение гантелей в стороны",
        "description": "Изолирующее упражнение для средних дельт.",
        "category": "strength",
        "equipment": ["dumbbells"],
        "muscle_groups": ["shoulders"],
    },
    {
        "slug": "seed-barbell-curl",
        "name": "Сгибание рук со штангой",
        "description": "Классическое сгибание рук со штангой на бицепс.",
        "category": "strength",
        "equipment": ["barbell"],
        "muscle_groups": ["biceps", "forearms"],
    },
    {
        "slug": "seed-tricep-pushdown",
        "name": "Разгибание рук на блоке",
        "description": "Разгибание рук в блочном тренажере для трицепсов.",
        "category": "strength",
        "equipment": ["cable_machine"],
        "muscle_groups": ["triceps"],
    },
    {
        "slug": "seed-plank",
        "name": "Планка",
        "description": "Изометрическое удержание для мышц кора.",
        "category": "strength",
        "equipment": [],
        "muscle_groups": ["core"],
    },
    {
        "slug": "seed-dead-bug",
        "name": "Мертвый жук",
        "description": "Упражнение лежа для контроля разгибания корпуса.",
        "category": "strength",
        "equipment": [],
        "muscle_groups": ["core"],
    },
    {
        "slug": "seed-treadmill-run",
        "name": "Бег на беговой дорожке",
        "description": "Ровный или интервальный бег в помещении.",
        "category": "cardio",
        "equipment": ["treadmill"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-bike-erg",
        "name": "Эйрбайк",
        "description": "Интервальная нагрузка на аэробайке для всего тела.",
        "category": "cardio",
        "equipment": ["assault_bike"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-rower",
        "name": "Гребной тренажер",
        "description": "Кардио для всего тела на гребном эргометре.",
        "category": "cardio",
        "equipment": ["rowing_machine"],
        "muscle_groups": ["full_body", "back"],
    },
    {
        "slug": "seed-jump-rope",
        "name": "Прыжки со скакалкой",
        "description": "Легкая кондиционная нагрузка и координация.",
        "category": "cardio",
        "equipment": ["jump_rope"],
        "muscle_groups": ["calves", "full_body"],
    },
    {
        "slug": "seed-yoga-flow",
        "name": "Йога-флоу",
        "description": "Последовательность для мобильности и баланса.",
        "category": "flexibility",
        "equipment": ["yoga_mat"],
        "muscle_groups": ["full_body"],
    },
    {
        "slug": "seed-hamstring-stretch",
        "name": "Растяжка задней поверхности бедра сидя",
        "description": "Пассивная растяжка задней цепи.",
        "category": "flexibility",
        "equipment": [],
        "muscle_groups": ["hamstrings"],
    },
    {
        "slug": "seed-kettlebell-swing",
        "name": "Мах гирей",
        "description": "Развитие мощности бедер и общей выносливости.",
        "category": "sport",
        "equipment": ["kettlebell"],
        "muscle_groups": ["glutes", "hamstrings", "core"],
    },
    {
        "slug": "seed-sled-push",
        "name": "Толкание саней",
        "description": "Тяжелая силовая и кондиционная нагрузка для нижней части тела.",
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
