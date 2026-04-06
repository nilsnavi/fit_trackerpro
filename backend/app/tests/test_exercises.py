import json

from app.settings import settings


async def test_create_custom_exercise_multipart(authenticated_client):
    data = {
        "name": "Custom Bench Press",
        "category": "strength",
        "description": "A custom bench press variation for testing.",
        "equipment": json.dumps(["barbell", "bench"]),
        "target_muscles": json.dumps(["Chest", "Triceps"]),
        "risks": json.dumps(["back"]),
        "difficulty": "beginner",
    }

    r = await authenticated_client.post("/api/v1/exercises/custom", data=data, files={})
    assert r.status_code == 201, r.text

    payload = r.json()
    assert payload["name"] == "Custom Bench Press"
    assert payload["category"] == "strength"
    assert payload["status"] == "pending"
    assert payload["equipment"] == ["barbell", "bench"]
    assert payload["muscle_groups"] == ["Chest", "Triceps"]
    assert payload["risk_flags"]["back_problems"] is True


async def test_create_exercise_json(authenticated_client):
    payload = {
        "name": "JSON Created Exercise",
        "category": "strength",
        "description": "Created via canonical JSON endpoint.",
        "equipment": ["dumbbells"],
        "muscle_groups": ["Chest"],
        "risk_flags": {
            "high_blood_pressure": False,
            "diabetes": False,
            "joint_problems": False,
            "back_problems": False,
            "heart_conditions": False,
        },
        "media_url": None,
    }

    r = await authenticated_client.post("/api/v1/exercises/", json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["name"] == "JSON Created Exercise"
    assert created["status"] == "pending"


async def test_create_custom_exercise_is_active_for_admin(authenticated_client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [123456789], raising=False)

    data = {
        "name": "Admin Custom Exercise",
        "category": "strength",
        "description": "Created by admin user.",
        "equipment": json.dumps(["barbell"]),
        "target_muscles": json.dumps(["Chest"]),
        "risks": json.dumps([]),
        "difficulty": "beginner",
    }

    r = await authenticated_client.post("/api/v1/exercises/custom", data=data, files={})
    assert r.status_code == 201, r.text

    payload = r.json()
    assert payload["status"] == "active"


async def test_create_exercise_json_is_active_for_admin(authenticated_client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [123456789], raising=False)

    payload = {
        "name": "Admin JSON Exercise",
        "category": "strength",
        "description": "Created by admin via JSON endpoint.",
        "equipment": ["dumbbells"],
        "muscle_groups": ["Chest"],
        "risk_flags": {
            "high_blood_pressure": False,
            "diabetes": False,
            "joint_problems": False,
            "back_problems": False,
            "heart_conditions": False,
        },
        "media_url": None,
    }

    r = await authenticated_client.post("/api/v1/exercises/", json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["status"] == "active"

