import re

from app.cli.seed_reference_data import _normalize_exercise_row
from scripts.import_exercises_dataset import (
    generate_catalog,
    map_category,
    map_equipment,
    map_muscles,
    resolve_name_ru,
    safe_truncate,
    slugify,
)


def _record(source_id: str, name: str, *, body_part: str = "chest", equipment: str = "barbell") -> dict:
    steps = ["Встаньте в исходное положение.", "Выполните движение плавно."]
    return {
        "id": source_id,
        "name": name,
        "category": body_part,
        "body_part": body_part,
        "equipment": equipment,
        "instructions": {"ru": " ".join(steps), "en": "Perform the movement."},
        "instruction_steps": {"ru": steps, "en": ["Set up.", "Move with control."]},
        "muscle_group": "triceps",
        "secondary_muscles": ["shoulders"],
        "target": "pectorals",
        "image": "images/0001-thumb.jpg",
        "gif_url": "videos/0001-animation.gif",
        "media_id": "thumb",
        "attribution": "© Gym visual — https://gymvisual.com/",
    }


def test_slugify_is_ascii_stable_and_bounded():
    value = "Ünicode / Bench Press: very long exercise name " * 10
    first = slugify(value, max_length=42)
    second = slugify(value, max_length=42)

    assert first == second
    assert len(first) <= 42
    assert re.fullmatch(r"[a-z0-9-]+", first)
    assert not first.endswith("-")


def test_equipment_mapping_uses_reference_codes():
    assert map_equipment("body weight") == (["none"], None)
    assert map_equipment("dumbbell") == (["dumbbells"], None)
    assert map_equipment("stability ball") == (["stability_ball"], None)
    assert map_equipment("new upstream object") == (["none"], "new upstream object")


def test_category_and_muscle_mappers_keep_domain_enums():
    assert map_category(_record("0001", "easy bike", body_part="cardio", equipment="body weight")) == "cardio"
    assert map_category(_record("0002", "hamstring stretch")) == "flexibility"
    assert map_category(_record("0003", "balance board")) == "balance"

    groups, primary, unmapped = map_muscles(_record("0004", "press"))
    assert groups == ["chest", "triceps", "shoulders"]
    assert primary == "chest"
    assert unmapped == []


def test_generated_names_are_russian_for_golden_common_exercises():
    golden = [
        _record("0025", "barbell bench press"),
        _record("0032", "barbell deadlift", body_part="back"),
        _record("0294", "dumbbell biceps curl", body_part="upper arms", equipment="dumbbell"),
        _record("0334", "dumbbell lateral raise", body_part="shoulders", equipment="dumbbell"),
    ]

    for record in golden:
        name, _quality = resolve_name_ru(record, {})
        assert re.search(r"[А-Яа-яЁё]", name)
        assert name.casefold() != record["name"].casefold()


def test_import_smoke_preserves_ru_steps_and_search_aliases():
    records = [
        _record("0001", "barbell bench press"),
        _record("0002", "dumbbell lateral raise", body_part="shoulders", equipment="dumbbell"),
        _record("0003", "cable row", body_part="back", equipment="cable"),
        _record("0004", "morning mobility", body_part="back", equipment="body weight"),
        _record("0005", "air bike", body_part="cardio", equipment="body weight"),
    ]

    rows, report = generate_catalog(records, name_overrides={})

    assert len(rows) == 5
    assert report["dataset_count"] == 5
    assert report["names_ru_failed"] == 0
    assert all(re.search(r"[А-Яа-яЁё]", row["name"]) for row in rows)
    assert all(len(row["description"]) <= 2000 for row in rows)
    assert rows[0]["metadata"]["source_name_en"] == "barbell bench press"
    assert "barbell bench press" in rows[0]["metadata"]["aliases"]
    assert rows[0]["metadata"]["instruction_steps_ru"] == records[0]["instruction_steps"]["ru"]
    assert rows[0]["media_url"] is None


def test_description_truncation_is_safe():
    text, truncated = safe_truncate("Шаг. " * 600)

    assert truncated is True
    assert len(text) <= 2000
    assert text.endswith("…")


def test_seed_normalization_persists_aliases_and_primary_muscle():
    normalized = _normalize_exercise_row(
        {
            "slug": "exds-0001-example",
            "name": "Пример",
            "category": "strength",
            "equipment": ["none"],
            "muscle_groups": ["abs", "back"],
            "metadata": {"aliases": ["example exercise"]},
        }
    )

    assert normalized["muscle_group"] == "abs"
    assert normalized["aliases"] == '["example exercise"]'
