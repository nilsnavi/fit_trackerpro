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
    assert payload["muscle_group"] == "Chest"
    assert payload["aliases"] == []
    assert payload["risk_flags"]["back_problems"] is True


async def test_create_exercise_json(authenticated_client):
    payload = {
        "name": "JSON Created Exercise",
        "category": "strength",
        "description": "Created via canonical JSON endpoint.",
        "equipment": ["dumbbells"],
        "muscle_groups": ["Chest"],
        "aliases": ["Bench Press Machine"],
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
    assert created["muscle_group"] == "Chest"
    assert created["aliases"] == ["Bench Press Machine"]


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


async def test_get_exercises_supports_search_filter_and_pagination(authenticated_client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [123456789], raising=False)

    payloads = [
        {
            "name": "Builder Query Chest Alpha",
            "category": "strength",
            "description": "Exercise for builder API test alpha.",
            "equipment": ["dumbbells"],
            "muscle_groups": ["Chest", "Triceps"],
            "aliases": ["builder-alpha-press"],
            "risk_flags": {
                "high_blood_pressure": False,
                "diabetes": False,
                "joint_problems": False,
                "back_problems": False,
                "heart_conditions": False,
            },
            "media_url": None,
        },
        {
            "name": "Builder Query Chest Beta",
            "category": "strength",
            "description": "Exercise for builder API test beta.",
            "equipment": ["barbell"],
            "muscle_groups": ["Chest", "Shoulders"],
            "aliases": ["builder-beta-press"],
            "risk_flags": {
                "high_blood_pressure": False,
                "diabetes": False,
                "joint_problems": False,
                "back_problems": False,
                "heart_conditions": False,
            },
            "media_url": None,
        },
        {
            "name": "Builder Query Legs Gamma",
            "category": "strength",
            "description": "Exercise for builder API test gamma.",
            "equipment": ["barbell"],
            "muscle_groups": ["Legs"],
            "aliases": ["builder-gamma-squat"],
            "risk_flags": {
                "high_blood_pressure": False,
                "diabetes": False,
                "joint_problems": False,
                "back_problems": False,
                "heart_conditions": False,
            },
            "media_url": None,
        },
    ]

    for payload in payloads:
        response = await authenticated_client.post("/api/v1/exercises/", json=payload)
        assert response.status_code == 201, response.text

    list_response = await authenticated_client.get(
        "/api/v1/exercises/",
        params={
            "search": "Builder Query",
            "muscle_group": "Chest",
            "page": 1,
            "page_size": 1,
        },
    )
    assert list_response.status_code == 200, list_response.text

    payload = list_response.json()
    assert payload["total"] == 2
    assert payload["page"] == 1
    assert payload["page_size"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["muscle_group"] == "Chest"
    assert payload["filters"]["search"] == "Builder Query"
    assert payload["filters"]["muscle_group"] == "Chest"


async def test_get_exercises_searches_aliases(authenticated_client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", [123456789], raising=False)

    payload = {
        "name": "Builder Alias Search Exercise",
        "category": "strength",
        "description": "Alias search coverage.",
        "equipment": ["dumbbells"],
        "muscle_groups": ["Chest"],
        "aliases": ["builder-alias-2026"],
        "risk_flags": {
            "high_blood_pressure": False,
            "diabetes": False,
            "joint_problems": False,
            "back_problems": False,
            "heart_conditions": False,
        },
        "media_url": None,
    }

    create_response = await authenticated_client.post("/api/v1/exercises/", json=payload)
    assert create_response.status_code == 201, create_response.text

    list_response = await authenticated_client.get(
        "/api/v1/exercises/",
        params={"search": "builder-alias-2026", "page": 1, "page_size": 20},
    )
    assert list_response.status_code == 200, list_response.text
    list_payload = list_response.json()
    assert list_payload["total"] >= 1
    assert any(item["name"] == "Builder Alias Search Exercise" for item in list_payload["items"])

