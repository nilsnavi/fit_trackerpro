"""Generate FitTracker Pro's system exercise catalog from exercises-dataset.

The generator is deliberately dependency-free and has no database side effects.  It
turns the upstream dataset (which uses body parts as categories and English exercise
names) into the domain contract used by FitTracker.  The checked-in NDJSON is a
reproducible build artifact; regenerate it from a local clone of the upstream
repository with::

    python backend/scripts/import_exercises_dataset.py \
        --input /path/to/exercises-dataset

Media is metadata-only by default.  ``--media-mode local`` is an explicit opt-in
that copies the upstream 180x180 GIFs to an ignored frontend directory and emits
local GIF URLs.  It never downloads media or changes the default build.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

# Pinned when the catalog was generated.  Update deliberately when refreshing the
# upstream source and record the new value in docs/exercises-catalog-dataset.md.
PINNED_DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd"
EXPECTED_DATASET_COUNT = 1324
MAX_SLUG_LENGTH = 180
MAX_DESCRIPTION_LENGTH = 2000
SOURCE_DATASET = "hasaneyldrm/exercises-dataset"
MEDIA_ATTRIBUTION = "© Gym visual — https://gymvisual.com/"

DEFAULT_REPO = Path("/tmp/exercises-dataset")
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "reference_data" / "exercises.ndjson"
DEFAULT_REPORT = REPO_ROOT / "reference_data" / "exercises_dataset_import_report.json"
DEFAULT_NAME_OVERRIDES = REPO_ROOT / "reference_data" / "exercises_dataset_name_ru.json"
DEFAULT_SLUG_OVERRIDES = REPO_ROOT / "reference_data" / "exercises_dataset_slug_overrides.json"
DEFAULT_MEDIA_OUTPUT = REPO_ROOT.parent / "frontend" / "public" / "exercise-media"

RISK_FLAGS: dict[str, bool] = {
    "high_blood_pressure": False,
    "diabetes": False,
    "joint_problems": False,
    "back_problems": False,
    "heart_conditions": False,
}

# FitTracker reference codes.  The values are intentionally explicit: an import
# must never leak arbitrary upstream strings into equipment/muscle JSON columns.
EQUIPMENT_MAP: dict[str, tuple[str, ...]] = {
    "body weight": ("none",),
    "bodyweight": ("none",),
    "none": ("none",),
    "dumbbell": ("dumbbells",),
    "dumbbells": ("dumbbells",),
    "barbell": ("barbell",),
    "ez barbell": ("barbell",),
    "ez-barbell": ("barbell",),
    "olympic barbell": ("barbell",),
    "trap bar": ("barbell",),
    "kettlebell": ("kettlebell",),
    "band": ("resistance_bands",),
    "resistance band": ("resistance_bands",),
    "resistance bands": ("resistance_bands",),
    "cable": ("cable_machine",),
    "cable machine": ("cable_machine",),
    "rope": ("cable_machine",),
    "battle ropes": ("none",),
    "smith machine": ("smith_machine",),
    "leverage machine": ("machine",),
    "machine": ("machine",),
    "sled machine": ("machine",),
    "sled": ("machine",),
    "stepmill machine": ("machine",),
    "stepper": ("machine",),
    "skierg machine": ("machine",),
    "upper body ergometer": ("machine",),
    "assisted": ("machine",),
    "stability ball": ("stability_ball",),
    "exercise ball": ("stability_ball",),
    "bosu ball": ("stability_ball",),
    "medicine ball": ("medicine_ball",),
    "roller": ("foam_roller",),
    "wheel roller": ("foam_roller",),
    "stationary bike": ("exercise_bike",),
    "stationary bicycle": ("exercise_bike",),
    "elliptical machine": ("elliptical",),
    # These describe load or an object rather than a supported FitTracker
    # equipment filter.  Keep the raw value in metadata and use the safe fallback.
    "weighted": ("none",),
    "tire": ("none",),
    "hammer": ("none",),
}

MUSCLE_MAP: dict[str, str] = {
    "abs": "abs",
    "abdominals": "abs",
    "rectus abdominis": "abs",
    "core": "abs",
    "obliques": "obliques",
    "quads": "quadriceps",
    "quadriceps": "quadriceps",
    "glutes": "glutes",
    "gluteus maximus": "glutes",
    "hamstrings": "hamstrings",
    "lats": "lats",
    "latissimus dorsi": "lats",
    "biceps": "biceps",
    "triceps": "triceps",
    "calves": "calves",
    "gastrocnemius": "calves",
    "soleus": "calves",
    "ankles": "calves",
    "ankle stabilizers": "calves",
    "lower back": "lower_back",
    "erector spinae": "lower_back",
    "spine": "lower_back",
    "traps": "traps",
    "trapezius": "traps",
    "delts": "shoulders",
    "deltoids": "shoulders",
    "shoulders": "shoulders",
    "rotator cuff": "shoulders",
    "pectorals": "chest",
    "pecs": "chest",
    "chest": "chest",
    "forearms": "forearms",
    "wrists": "forearms",
    "wrist extensors": "forearms",
    "wrist flexors": "forearms",
    "hands": "forearms",
    "hip flexors": "hip_flexors",
    "iliopsoas": "hip_flexors",
    "adductors": "adductors",
    "groin": "adductors",
    "abductors": "abductors",
    "cardiovascular system": "full_body",
    "back": "back",
    "upper back": "back",
    "rhomboids": "back",
    "levator scapulae": "back",
    "serratus anterior": "shoulders",
    "rear deltoids": "shoulders",
    "brachialis": "biceps",
    "feet": "calves",
    "grip muscles": "forearms",
    "inner thighs": "adductors",
    "lower abs": "abs",
    "shins": "calves",
    "sternocleidomastoid": "shoulders",
    "upper chest": "chest",
}

TARGET_RU: dict[str, str] = {
    "abs": "пресса",
    "abdominals": "пресса",
    "adductors": "приводящих мышц",
    "abductors": "отводящих мышц",
    "biceps": "бицепса",
    "calves": "икроножных мышц",
    "cardiovascular system": "выносливости",
    "delts": "плеч",
    "forearms": "предплечий",
    "glutes": "ягодиц",
    "hamstrings": "задней поверхности бедра",
    "hip flexors": "сгибателей бедра",
    "lats": "широчайших мышц",
    "lower back": "поясницы",
    "obliques": "косых мышц живота",
    "pectorals": "груди",
    "quads": "квадрицепсов",
    "quadriceps": "квадрицепсов",
    "serratus anterior": "передней зубчатой мышцы",
    "spine": "поясницы",
    "traps": "трапеций",
    "triceps": "трицепса",
    "upper back": "верхней части спины",
}

EQUIPMENT_RU: dict[str, str] = {
    "barbell": "со штангой",
    "dumbbell": "с гантелями",
    "kettlebell": "с гирей",
    "cable": "на блоке",
    "band": "с резинкой",
    "resistance band": "с резинкой",
    "smith machine": "в машине Смита",
    "leverage machine": "в тренажёре",
    "machine": "в тренажёре",
    "assisted": "с помощью тренажёра",
    "medicine ball": "с медболом",
    "stability ball": "на фитболе",
    "bosu ball": "на BOSU",
    "weighted": "с отягощением",
    "trap bar": "с трэп-грифом",
}

_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
_SPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")

# A small high-quality layer for common movements.  The JSON override file is the
# public/editable version of this policy; these values also make the generator
# useful in a clean checkout before overrides are created.
BUILTIN_NAME_OVERRIDES: dict[str, str] = {
    "0001": "Подъём корпуса на три четверти",
    "0025": "Жим штанги лёжа",
    "0032": "Становая тяга со штангой",
    "0043": "Полный присед со штангой",
    "0062": "Подтягивание",
    "0652": "Подтягивание",
    "0294": "Сгибание рук с гантелями",
    "0334": "Разведение гантелей в стороны",
    "0687": "Русские скручивания",
    "0811": "Становая тяга с трэп-грифом",
    "2612": "Прыжки со скакалкой",
    "0630": "Альпинист",
    "1160": "Берпи",
    "0798": "Ходьба на велотренажёре",
    "2141": "Ходьба на эллиптическом тренажёре",
    "0739": "Жим ногами под углом 45 градусов",
    "0044": "Наклоны со штангой",
    "0054": "Выпады со штангой",
    "0069": "Приседание со штангой над головой",
    "0085": "Румынская тяга со штангой",
    "0091": "Жим штанги над головой сидя",
    "0092": "Разгибание рук со штангой над головой",
    "0140": "Подтягивание",
    "0178": "Разведение рук на блоке в стороны",
    "0241": "Разгибание рук на блоке",
    "0274": "Скручивания лёжа",
    "0414": "Попеременный жим гантелей над головой",
    "0426": "Жим гантелей над головой стоя",
    "0464": "Планка со скручиванием",
    "0501": "Берпи с прыжком",
    "0507": "Складка лёжа",
    "0584": "Разведение рук в тренажёре в стороны",
    "0603": "Жим плеч в тренажёре",
    "0662": "Отжимания",
    "0664": "Отжимание с переходом в боковую планку",
    "0688": "Подтягивание с движением лопаток",
    "0766": "Жим плеч в машине Смита",
    "0770": "Приседание в машине Смита",
    "0774": "Жим в машине Смита над головой",
    "0857": "Ролик для пресса",
}


def slugify(value: str, *, max_length: int = MAX_SLUG_LENGTH) -> str:
    """Return a stable ASCII slug, bounded to the FitTracker column length."""

    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = _NON_ALNUM_RE.sub("-", ascii_value).strip("-")
    return slug[:max_length].rstrip("-") or "exercise"


def dataset_slug(record: Mapping[str, Any]) -> str:
    source_id = str(record["id"]).zfill(4)
    prefix = f"exds-{source_id}-"
    return f"{prefix}{slugify(str(record['name']), max_length=MAX_SLUG_LENGTH - len(prefix))}"


def _normalise_raw(value: Any) -> str:
    return _SPACE_RE.sub(" ", str(value or "").strip().lower())


def map_equipment(raw: Any) -> tuple[list[str], str | None]:
    """Map one upstream equipment label and return codes plus unmapped raw value."""

    key = _normalise_raw(raw)
    mapped = EQUIPMENT_MAP.get(key)
    if mapped is None:
        return ["none"], key or None
    return list(dict.fromkeys(mapped)), None


def map_muscle(raw: Any) -> str | None:
    key = _normalise_raw(raw)
    return MUSCLE_MAP.get(key)


def map_category(record: Mapping[str, Any]) -> str:
    """Map upstream body-part taxonomy to FitTracker's stable category enum."""

    name = _normalise_raw(record.get("name"))
    body_part = _normalise_raw(record.get("body_part") or record.get("category"))
    if body_part == "cardio":
        return "cardio"
    if re.search(r"\b(stretch|stretching|mobility|mobilization|yoga|flexibility)\b", name):
        return "flexibility"
    if re.search(r"\b(balance board|single[- ]leg balance|tree pose|standing balance)\b", name) and not re.search(
        r"\b(squat|push[- ]?up|crunch|curl|press|row|lunge|raise|deadlift)\b", name
    ):
        return "balance"
    if re.search(r"\b(rehab|rehabilitation|therapy|therapeutic|physio)\b", name):
        return "rehab"
    return "strength"


def _dedupe(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = str(value).strip()
        if value and value not in seen:
            result.append(value)
            seen.add(value)
    return result


def map_muscles(record: Mapping[str, Any]) -> tuple[list[str], str, list[str]]:
    """Map target first, then synergist and secondary muscles.

    The third return value contains raw labels that were retained in metadata and
    were not known to the FitTracker reference table.
    """

    raw_values = [record.get("target"), record.get("muscle_group")]
    raw_values.extend(record.get("secondary_muscles") or [])
    mapped: list[str] = []
    unmapped: list[str] = []
    for raw in raw_values:
        if not raw:
            continue
        code = map_muscle(raw)
        if code:
            mapped.append(code)
        else:
            unmapped.append(_normalise_raw(raw))
    mapped = _dedupe(mapped)[:10]
    if not mapped:
        body_part = _normalise_raw(record.get("body_part"))
        mapped = ["full_body" if body_part == "cardio" else "back"]
    return mapped, mapped[0], _dedupe(unmapped)


def _target_phrase(record: Mapping[str, Any]) -> str:
    raw = _normalise_raw(record.get("target"))
    return TARGET_RU.get(raw, "всего тела")


def _equipment_phrase(name: str) -> str:
    lowered = _normalise_raw(name)
    for key in (
        "smith machine",
        "stability ball",
        "medicine ball",
        "leverage machine",
        "resistance band",
        "dumbbell",
        "barbell",
        "kettlebell",
        "cable",
        "band",
        "assisted",
        "weighted",
        "trap bar",
    ):
        if key in lowered:
            return EQUIPMENT_RU[key]
    return ""


def _qualifiers(name: str) -> list[str]:
    lowered = _normalise_raw(name)
    result: list[str] = []
    patterns = (
        (r"\bone arm\b|\bone hand\b", "одной рукой"),
        (r"\bone leg\b|\bsingle leg\b", "на одной ноге"),
        (r"\balternat(?:e|ing)\b", "попеременный"),
        (r"\bclose[- ]grip\b|\bnarrow\b", "узким хватом"),
        (r"\bwide[- ]grip\b|\bwide grip\b", "широким хватом"),
        (r"\breverse grip\b|\bunderhand\b|\bsupinated\b", "обратным хватом"),
        (r"\bseated\b", "сидя"),
        (r"\bstanding\b", "стоя"),
        (r"\bkneeling\b", "с колен"),
        (r"\blying\b|\bon floor\b", "лёжа"),
        (r"\bincline\b", "на наклонной скамье"),
        (r"\bdecline\b", "на скамье с отрицательным наклоном"),
    )
    for pattern, phrase in patterns:
        if re.search(pattern, lowered) and phrase not in result:
            result.append(phrase)
    return result


def _with_equipment(base: str, name: str, *, already_has_equipment: bool = False) -> str:
    if already_has_equipment:
        return base
    equipment = _equipment_phrase(name)
    return f"{base} {equipment}".strip() if equipment else base


def generate_russian_name(record: Mapping[str, Any]) -> str:
    """Generate a readable Russian label without ever using English as fallback."""

    original = _normalise_raw(record.get("name"))
    qualifiers = _qualifiers(original)
    qualifier_text = ", ".join(qualifiers)
    target = _target_phrase(record)

    # Specific movement families are ordered before generic words such as press,
    # raise and curl.  This keeps common variants recognisable in the UI.
    if "world greatest stretch" in original:
        return "Растяжка «величайшая в мире»"
    if "stretch" in original or "stretching" in original:
        base = f"Растяжка для {target}"
        return f"{base} ({qualifier_text})" if qualifier_text else base
    if "jump rope" in original:
        return "Прыжки со скакалкой"
    if "mountain climber" in original:
        return "Альпинист"
    if "burpee" in original:
        base = "Берпи"
        return f"{base} ({qualifier_text})" if qualifier_text else base
    if "jumping jack" in original or "star jump" in original:
        return "Прыжки с разведением рук и ног"
    if "treadmill" in original:
        return "Ходьба на беговой дорожке" if "walk" in original else "Бег на беговой дорожке"
    if "elliptical" in original:
        return "Ходьба на эллиптическом тренажёре"
    if "stationary bike" in original or "exercise bike" in original:
        return "Занятие на велотренажёре"
    if "ski erg" in original or "skierg" in original:
        return "Тяга на лыжном тренажёре"
    if "stepmill" in original or "stepper" in original:
        return "Подъём по ступеням в тренажёре"
    if "rowing" in original and "row" not in original.replace("rowing", ""):
        return "Гребля на тренажёре"

    if "pull-up" in original or "pull up" in original or "chin-up" in original or "chin up" in original:
        base = "Подтягивание"
        if "assisted" in original:
            base += " с помощью"
        if "wide" in original:
            base += " широким хватом"
        elif "close" in original or "narrow" in original:
            base += " узким хватом"
        elif "reverse" in original:
            base += " обратным хватом"
        return base
    if "pulldown" in original:
        base = "Тяга верхнего блока"
        if "close" in original or "narrow" in original:
            base += " узким хватом"
        return _with_equipment(base, original, already_has_equipment=True)
    if "push-up" in original or "push up" in original:
        base = "Отжимание"
        if "close" in original or "diamond" in original:
            base += " узким хватом"
        elif "wide" in original:
            base += " широким хватом"
        elif "incline" in original:
            base += " с опорой на возвышенность"
        elif "decline" in original:
            base += " с ногами на возвышенности"
        elif "handstand" in original:
            base += " в стойке на руках"
        elif "wall" in original:
            base += " от стены"
        elif "kneeling" in original:
            base += " с колен"
        return _with_equipment(base, original)

    if "bench press" in original:
        base = "Жим"
        if "close" in original:
            base += " узким хватом"
        elif "wide" in original:
            base += " широким хватом"
        base += " лёжа"
        if "incline" in original:
            base += " на наклонной скамье"
        elif "decline" in original:
            base += " на скамье с отрицательным наклоном"
        return _with_equipment(base, original)
    if "chest press" in original:
        return _with_equipment("Жим на грудь", original)
    if "shoulder press" in original or "overhead press" in original or "military press" in original:
        base = "Жим над головой"
        if "military" in original:
            base = "Армейский жим"
        return _with_equipment(base, original)
    if "clean and press" in original:
        return _with_equipment("Взятие на грудь и жим", original)
    if "push press" in original:
        return _with_equipment("Толчковый жим", original)
    if "pallof press" in original or "palof press" in original:
        return "Жим Паллофа"
    if "press" in original and "leg press" not in original:
        return _with_equipment("Жим", original)

    if "deadlift" in original:
        if "romanian" in original:
            base = "Румынская тяга"
        elif "stiff leg" in original or "straight leg" in original:
            base = "Тяга на прямых ногах"
        elif "sumo" in original:
            base = "Сумо-тяга"
        else:
            base = "Становая тяга"
        return _with_equipment(base, original)
    if "good morning" in original:
        return _with_equipment("Наклоны со штангой", original)
    if "squat" in original:
        if "split squat" in original:
            base = "Болгарское сплит-приседание"
        elif "front squat" in original:
            base = "Фронтальное приседание"
        elif "hack squat" in original:
            base = "Гакк-приседание"
        elif "jump squat" in original:
            base = "Прыжок из приседа"
        elif "sumo squat" in original:
            base = "Сумо-приседание"
        elif "single leg" in original or "one leg" in original:
            base = "Приседание на одной ноге"
        else:
            base = "Приседание"
        return _with_equipment(base, original)
    if "lunge" in original:
        base = "Выпад"
        if "walking" in original:
            base = "Выпады в ходьбе"
        elif "lateral" in original:
            base = "Боковой выпад"
        elif "rear" in original or "backward" in original:
            base = "Обратный выпад"
        return _with_equipment(base, original)

    if "calf raise" in original or "calf raises" in original:
        base = "Подъём на носки"
        return _with_equipment(base, original)
    if "leg press" in original:
        return _with_equipment("Жим ногами", original)
    if "leg extension" in original:
        return _with_equipment("Разгибание ног", original)
    if "leg curl" in original or "hamstring curl" in original:
        return _with_equipment("Сгибание ног", original)
    if "raise" in original:
        if "leg raise" in original:
            base = "Подъём ног"
        elif "hip raise" in original:
            base = "Подъём таза"
        elif "lateral" in original or "rear delt" in original:
            base = "Разведение рук в стороны"
        elif "front raise" in original:
            base = "Подъём рук перед собой"
        else:
            base = "Подъём"
        return _with_equipment(base, original)

    if "triceps pushdown" in original or "pushdown" in original:
        return _with_equipment("Разгибание рук на блоке", original, already_has_equipment=True)
    if "triceps extension" in original or "tricep extension" in original:
        return _with_equipment("Разгибание рук на трицепс", original)
    if "triceps dip" in original or "three bench dip" in original or "bench dip" in original:
        return _with_equipment("Отжимание от скамьи", original)
    if "dip" in original:
        return "Отжимание на брусьях"
    if "curl" in original:
        if "wrist" in original:
            base = "Сгибание кистей"
        elif "leg" in original:
            base = "Сгибание ног"
        else:
            base = "Сгибание рук"
        return _with_equipment(base, original)
    if "row" in original or "rowing" in original:
        base = "Тяга"
        if "upright" in original:
            base = "Тяга к подбородку"
        elif "one arm" in original:
            base += " одной рукой"
        elif "bent over" in original or "incline" in original:
            base += " в наклоне"
        return _with_equipment(base, original)
    if "fly" in original:
        return _with_equipment("Разведение рук", original)
    if "shrug" in original:
        return _with_equipment("Шраги", original)
    if "plank" in original:
        base = "Планка"
        if "side" in original:
            base += " боковая"
        return _with_equipment(base, original)
    if "crunch" in original:
        base = "Скручивания"
        if "reverse" in original:
            base = "Обратные скручивания"
        elif "oblique" in original or "side" in original:
            base = "Косые скручивания"
        return _with_equipment(base, original)
    if "sit-up" in original or "sit up" in original:
        return _with_equipment("Подъём корпуса", original)
    if "russian twist" in original:
        return _with_equipment("Русские скручивания", original)
    if "v-up" in original or "v up" in original:
        return _with_equipment("Складка V", original)
    if "hip thrust" in original or "glute bridge" in original or "glute bridge" in original:
        return _with_equipment("Ягодичный мост", original)
    if "swing" in original:
        return _with_equipment("Мах", original)
    if "snatch" in original:
        return _with_equipment("Рывок", original)
    if "clean" in original:
        return _with_equipment("Взятие на грудь", original)
    if "jerk" in original:
        return _with_equipment("Толчок", original)
    if "superman" in original:
        return "Супермен"
    if "wheel roller" in original or "rollerout" in original:
        return "Ролик для пресса"
    if "balance board" in original:
        return "Баланс на балансировочной платформе"
    if "back extension" in original or "hyperextension" in original:
        return _with_equipment("Гиперэкстензия", original)
    if "breathing" in original:
        return "Дыхательное упражнение"
    if "walk" in original:
        return "Ходьба"
    if "run" in original or "sprint" in original:
        return "Бег"
    if "jump" in original:
        return "Прыжки"
    if "rotation" in original or "twist" in original:
        return _with_equipment(f"Повороты для {target}", original)

    # The upstream catalog contains a long tail of named calisthenics and
    # mobility drills.  Keep their Russian labels useful instead of collapsing
    # every unfamiliar verb into "упражнение для ...".
    long_tail: tuple[tuple[str, str], ...] = (
        ("side bend", "Боковые наклоны"),
        ("air bike", "Эйрбайк"),
        ("heel toucher", "Касания пяток"),
        ("ankle circle", "Круги стопами"),
        ("arm slinger", "Подъём ног в висе"),
        ("toe touch", "Касание носков"),
        ("back lever", "Горизонтальный вис на кольцах"),
        ("front lever", "Передний вис"),
        ("planche", "Планш"),
        ("step-up", "Зашагивание на платформу"),
        ("step up", "Зашагивание на платформу"),
        ("hip extension", "Разгибание бедра"),
        ("hip lift", "Подъём таза"),
        ("pull through", "Протяжка"),
        ("pullover", "Пуловер"),
        ("rack pull", "Тяга с плинтов"),
        ("skier", "Лыжник"),
        ("thruster", "Трастер"),
        ("battling rope", "Волны канатами"),
        ("bear crawl", "Медвежья ходьба"),
        ("body-up", "Подъём корпуса"),
        ("bottoms-up", "Подъём таза"),
        ("butt-up", "Подъём таза"),
        ("cross-over", "Кроссовер"),
        ("crossover", "Кроссовер"),
        ("hip adduction", "Приведение бедра"),
        ("hip abduction", "Отведение бедра"),
        ("judo flip", "Переворот дзюдо"),
        ("kickback", "Отведение назад"),
        ("dead bug", "Мёртвый жук"),
        ("cocoons", "Кокон"),
        ("cycle cross trainer", "Занятие на эллиптическом тренажёре"),
        ("iron cross", "Железный крест"),
        ("pronation", "Пронация предплечья"),
        ("supination", "Супинация предплечья"),
        ("around the world", "Вокруг света"),
        ("carry", "Перенос веса"),
        ("windmill", "Мельница"),
        ("figure 8", "Восьмёрка"),
        ("high knee", "Высокие колени"),
        ("inchworm", "Червячок"),
        ("isometric", "Изометрическое удержание"),
        ("muscle up", "Выход силой"),
        ("slam", "Бросок мяча вниз"),
        ("pelvic tilt", "Наклон таза"),
        ("quick feet", "Быстрые шаги"),
        ("reverse hyper", "Обратная гиперэкстензия"),
        ("body saw", "Пила с роликом"),
        ("rope climb", "Лазание по канату"),
        ("shoulder tap", "Касание плеч в планке"),
        ("side bridge", "Боковая планка"),
        ("skater hop", "Прыжки конькобежца"),
        ("ski step", "Лыжный шаг"),
        ("skin the cat", "Выход в вис с разворотом"),
        ("sledge hammer", "Удары молотом"),
        ("sphinx", "Поза сфинкса"),
        ("swimmer kick", "Удары ногами пловца"),
        ("tire flip", "Переворот покрышки"),
        ("upward facing dog", "Поза собаки мордой вверх"),
        ("v-sit", "V-сед"),
        ("hand squeeze", "Сжатие кистей"),
        ("wrist circle", "Круги кистями"),
        ("wrist roller", "Ролик для предплечий"),
    )
    for needle, label in long_tail:
        if needle in original:
            result = _with_equipment(label, original)
            if qualifier_text and qualifier_text not in result:
                result = f"{result} ({qualifier_text})"
            return result

    # Safe Russian-only final template.  It is intentionally descriptive rather
    # than transliterating an unknown English title into a user-visible label.
    if "mobility" in original:
        movement = "Упражнение на мобильность"
    elif "balance" in original or "stability" in original:
        movement = "Упражнение на баланс"
    else:
        movement = "Упражнение для"
    if movement.endswith("для"):
        result = f"{movement} {target}"
    else:
        result = movement
    equipment = _equipment_phrase(original)
    if equipment and equipment not in result:
        result = f"{result} {equipment}"
    if qualifier_text and qualifier_text not in result:
        result = f"{result} ({qualifier_text})"
    return result


def resolve_name_ru(record: Mapping[str, Any], overrides: Mapping[str, str]) -> tuple[str, str]:
    candidates = [
        str(record.get("id", "")),
        str(record.get("name", "")),
        _normalise_raw(record.get("name")),
        dataset_slug(record),
    ]
    for key in candidates:
        value = overrides.get(key) or BUILTIN_NAME_OVERRIDES.get(key)
        if value and _CYRILLIC_RE.search(value) and value.strip().casefold() != str(record["name"]).strip().casefold():
            return value.strip(), "overridden"
    generated = generate_russian_name(record).strip()
    if _CYRILLIC_RE.search(generated) and generated.casefold() != str(record["name"]).strip().casefold():
        return generated, "generated"
    # This branch is fail-closed: it is Russian and cannot expose the upstream
    # English name even when a new upstream movement is entirely unfamiliar.
    return f"Упражнение для {_target_phrase(record)}", "generated"


def safe_truncate(text: str, limit: int = MAX_DESCRIPTION_LENGTH) -> tuple[str, bool]:
    text = str(text or "").strip()
    if len(text) <= limit:
        return text, False
    suffix = "…"
    return text[: limit - len(suffix)].rstrip() + suffix, True


def load_overrides(path: Path | None) -> dict[str, str]:
    if not path or not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"override file must contain an object: {path}")
    return {str(k): str(v) for k, v in payload.items() if str(v).strip()}


def validate_dataset(records: Sequence[Mapping[str, Any]], *, expected_count: int | None = EXPECTED_DATASET_COUNT) -> None:
    if expected_count is not None and len(records) != expected_count:
        raise ValueError(f"expected {expected_count} dataset records, got {len(records)}")
    required = ("id", "name", "body_part", "equipment", "instructions", "instruction_steps")
    for record in records:
        missing = [key for key in required if key not in record]
        if missing:
            raise ValueError(f"{record.get('id', '<unknown>')}: missing {', '.join(missing)}")
        source_id = str(record["id"])
        if not re.fullmatch(r"\d{4}", source_id):
            raise ValueError(f"source id must be four digits: {source_id!r}")
        steps = (record.get("instruction_steps") or {}).get("ru")
        if not isinstance(steps, list) or not any(str(step).strip() for step in steps):
            raise ValueError(f"{source_id}: Russian instruction_steps.ru is required")


def load_dataset(input_path: Path) -> list[dict[str, Any]]:
    path = input_path / "data" / "exercises.json" if input_path.is_dir() else input_path
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"dataset must be a JSON array: {path}")
    return [dict(item) for item in payload]


def _aliases(record: Mapping[str, Any], slug: str) -> list[str]:
    original = str(record["name"]).strip()
    variants = [original, original.replace("-", " "), slug.removeprefix("exds-")]
    # English belongs in aliases/search metadata, not in name.
    return _dedupe(variants)


def convert_record(
    record: Mapping[str, Any],
    *,
    name_overrides: Mapping[str, str],
    media_mode: str = "metadata",
    media_source_root: Path | None = None,
    media_output: Path = DEFAULT_MEDIA_OUTPUT,
) -> tuple[dict[str, Any], dict[str, Any]]:
    slug = dataset_slug(record)
    name_ru, name_quality = resolve_name_ru(record, name_overrides)
    equipment, equipment_unmapped = map_equipment(record.get("equipment"))
    muscle_groups, primary_muscle, muscles_unmapped = map_muscles(record)
    steps_ru = [str(step).strip() for step in (record.get("instruction_steps") or {}).get("ru", []) if str(step).strip()]
    steps_en = [str(step).strip() for step in (record.get("instruction_steps") or {}).get("en", []) if str(step).strip()]
    description, truncated = safe_truncate("\n".join(steps_ru))
    aliases = _aliases(record, slug)
    gif_path = str(record.get("gif_url") or "")
    image_path = str(record.get("image") or "")
    media_url: str | None = None
    if media_mode == "local" and gif_path:
        media_url = f"/exercise-media/{Path(gif_path).name}"
        if media_source_root:
            source = media_source_root / gif_path
            if source.exists():
                media_output.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, media_output / Path(gif_path).name)

    metadata: dict[str, Any] = {
        "source_dataset": SOURCE_DATASET,
        "source_commit": PINNED_DATASET_COMMIT,
        "source_id": str(record["id"]),
        "source_name_en": str(record["name"]),
        "name_ru": name_ru,
        "name_ru_quality": name_quality,
        "body_part": str(record.get("body_part") or record.get("category") or ""),
        "target_raw": str(record.get("target") or ""),
        "muscle_group_raw": str(record.get("muscle_group") or ""),
        "secondary_muscles_raw": [str(value) for value in (record.get("secondary_muscles") or [])],
        "equipment_raw": str(record.get("equipment") or ""),
        "instruction_steps_ru": steps_ru,
        "instruction_steps_en": steps_en,
        "aliases": aliases,
        "attribution": str(record.get("attribution") or MEDIA_ATTRIBUTION),
        "media": {
            "image_path": image_path,
            "gif_path": gif_path,
            "media_id": str(record.get("media_id") or ""),
        },
    }
    if equipment_unmapped:
        metadata["equipment_unmapped"] = equipment_unmapped
    if muscles_unmapped:
        metadata["muscles_unmapped"] = muscles_unmapped

    row = {
        "slug": slug,
        "name": name_ru,
        "description": description,
        "category": map_category(record),
        "equipment": equipment,
        "muscle_groups": muscle_groups,
        "muscle_group": primary_muscle,
        "risk_flags": dict(RISK_FLAGS),
        "media_url": media_url,
        "status": "active",
        "metadata": metadata,
    }
    stats = {
        "name_quality": name_quality,
        "equipment_raw": _normalise_raw(record.get("equipment")),
        "equipment_unmapped": equipment_unmapped,
        "muscles_unmapped": muscles_unmapped,
        "description_truncated": truncated,
        "category": row["category"],
        "slug": slug,
    }
    return row, stats


def _read_ndjson(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid NDJSON at {path}:{line_number}: {exc}") from exc
    return rows


def _legacy_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for row in rows:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        if metadata.get("source_dataset") == SOURCE_DATASET:
            continue
        result.append(dict(row))
    return result


def generate_catalog(
    records: Sequence[Mapping[str, Any]],
    *,
    legacy_rows: Sequence[Mapping[str, Any]] = (),
    name_overrides: Mapping[str, str] | None = None,
    slug_overrides: Mapping[str, str] | None = None,
    media_mode: str = "metadata",
    media_source_root: Path | None = None,
    media_output: Path = DEFAULT_MEDIA_OUTPUT,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Pure conversion/merge function used by the CLI and unit tests."""

    validate_dataset(records, expected_count=None)
    name_overrides = name_overrides or {}
    slug_overrides = slug_overrides or {}
    imported: list[dict[str, Any]] = []
    stats: list[dict[str, Any]] = []
    for record in records:
        row, row_stats = convert_record(
            record,
            name_overrides=name_overrides,
            media_mode=media_mode,
            media_source_root=media_source_root,
            media_output=media_output,
        )
        override_key = str(record.get("id"))
        explicit_slug = slug_overrides.get(override_key) or slug_overrides.get(str(record.get("name")))
        if explicit_slug:
            row["slug"] = str(explicit_slug)[:MAX_SLUG_LENGTH].rstrip("-")
            row_stats["slug"] = row["slug"]
            row["metadata"]["slug_override"] = True
        imported.append(row)
        stats.append(row_stats)

    legacy = _legacy_rows(legacy_rows)
    all_rows = legacy + imported
    slug_collisions = [slug for slug, count in Counter(str(row.get("slug")) for row in all_rows).items() if count > 1]
    invalid_names: list[Any] = []
    for row in all_rows:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        source_name = metadata.get("source_name_en")
        if not _CYRILLIC_RE.search(str(row.get("name") or "")) or (
            source_name and str(row.get("name")).casefold() == str(source_name).casefold()
        ):
            invalid_names.append(row.get("slug"))
    invalid_categories = [row.get("slug") for row in all_rows if row.get("category") not in {"strength", "cardio", "flexibility", "balance", "sport", "rehab"}]

    report = {
        "source_dataset": SOURCE_DATASET,
        "dataset_commit": PINNED_DATASET_COMMIT,
        "dataset_count": len(records),
        "legacy_rows_preserved": len(legacy),
        "output_row_count": len(all_rows),
        "media_mode": media_mode,
        "media_binaries_in_catalog": False,
        "names_ru_overridden": sum(item["name_quality"] == "overridden" for item in stats),
        "names_ru_generated": sum(item["name_quality"] == "generated" for item in stats),
        "names_ru_failed": len(invalid_names),
        "generated_name_samples": [
            {"source_id": str(records[index]["id"]), "source_name_en": str(records[index]["name"]), "name_ru": imported[index]["name"]}
            for index, item in enumerate(stats)
            if item["name_quality"] == "generated"
        ][:25],
        "unmapped_equipment": dict(sorted(Counter(item["equipment_unmapped"] for item in stats if item["equipment_unmapped"]).items())),
        "unmapped_muscles": dict(sorted(Counter(raw for item in stats for raw in item["muscles_unmapped"]).items())),
        "description_truncated_count": sum(item["description_truncated"] for item in stats),
        "category_counts": dict(sorted(Counter(item["category"] for item in stats).items())),
        "equipment_counts": dict(sorted(Counter(code for row in imported for code in row["equipment"]).items())),
        "muscle_group_counts": dict(sorted(Counter(code for row in imported for code in row["muscle_groups"]).items())),
        "slug_collisions": sorted(slug_collisions),
        "invalid_categories": invalid_categories,
        "generated_rows_have_cyrillic_names": not invalid_names,
        "description_max_length": max((len(str(row.get("description") or "")) for row in imported), default=0),
        "notes": [
            "English source names are stored only in metadata.aliases/source_name_en.",
            "Russian instructions are joined into description and retained as metadata.instruction_steps_ru.",
            "Media URLs are null unless EXERCISES_MEDIA_MODE=local is explicitly selected.",
            "Legacy rows are preserved; only exds-* rows are managed by the dataset archive policy.",
        ],
    }
    return all_rows, report


def write_ndjson(path: Path, rows: Sequence[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path(os.getenv("EXERCISES_DATASET_DIR", DEFAULT_REPO)))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--name-overrides", type=Path, default=DEFAULT_NAME_OVERRIDES)
    parser.add_argument("--slug-overrides", type=Path, default=DEFAULT_SLUG_OVERRIDES)
    parser.add_argument("--legacy", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--no-legacy", action="store_true", help="Do not preserve existing non-dataset rows")
    parser.add_argument(
        "--media-mode",
        choices=("metadata", "local"),
        default=os.getenv("EXERCISES_MEDIA_MODE", "metadata"),
        help="metadata (default, no binaries) or local (copy 180x180 GIFs to --media-output)",
    )
    parser.add_argument("--media-output", type=Path, default=DEFAULT_MEDIA_OUTPUT)
    parser.add_argument("--allow-count", action="store_true", help="Allow a fixture/input other than 1,324 records")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    records = load_dataset(input_path)
    validate_dataset(records, expected_count=None if args.allow_count else EXPECTED_DATASET_COUNT)
    existing = [] if args.no_legacy else _read_ndjson(args.legacy.resolve())
    names = load_overrides(args.name_overrides.resolve() if args.name_overrides else None)
    slugs = load_overrides(args.slug_overrides.resolve() if args.slug_overrides else None)
    rows, report = generate_catalog(
        records,
        legacy_rows=existing,
        name_overrides=names,
        slug_overrides=slugs,
        media_mode=args.media_mode,
        media_source_root=input_path if input_path.is_dir() else input_path.parent.parent,
        media_output=args.media_output.resolve(),
    )
    if report["names_ru_failed"] or report["slug_collisions"] or report["invalid_categories"]:
        raise SystemExit(
            "import quality gate failed: "
            f"names_ru_failed={report['names_ru_failed']} "
            f"slug_collisions={report['slug_collisions']} "
            f"invalid_categories={report['invalid_categories']}"
        )
    write_ndjson(args.output.resolve(), rows)
    args.report.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.report.resolve().write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Imported {report['dataset_count']} dataset rows + {report['legacy_rows_preserved']} legacy rows "
        f"=> {report['output_row_count']} catalog rows; "
        f"RU names overridden={report['names_ru_overridden']}, generated={report['names_ru_generated']}; "
        f"media_mode={args.media_mode}"
    )


if __name__ == "__main__":
    main()
