"""
OpenAPI tag names and metadata for Swagger / ReDoc.

Single source of truth: use these constants in ``registration.register_v1_routes``
(``include_router(..., tags=[...])``) and keep ``openapi_tags`` on FastAPI in sync.
"""
from __future__ import annotations

from typing import Any

# Tag names (shown as section titles in /docs)
TAG_SYSTEM = "System"
TAG_INTEGRATIONS = "Integrations"
TAG_AUTHENTICATION = "Authentication"
TAG_USERS = "Users"
TAG_WORKOUTS = "Workouts"
TAG_EXERCISES = "Exercises"
TAG_HEALTH_METRICS = "Health metrics"
TAG_ANALYTICS = "Analytics"
TAG_ACHIEVEMENTS = "Achievements"
TAG_CHALLENGES = "Challenges"
TAG_EMERGENCY = "Emergency"

OPENAPI_TAGS: list[dict[str, Any]] = [
    {
        "name": TAG_SYSTEM,
        "description": "Liveness/readiness probes, service version, and public API metadata.",
    },
    {
        "name": TAG_INTEGRATIONS,
        "description": "Inbound webhooks and third-party integration endpoints.",
    },
    {
        "name": TAG_AUTHENTICATION,
        "description": "Public: Telegram login and token refresh. Protected: profile, logout (Bearer).",
    },
    {
        "name": TAG_USERS,
        "description": "Public: create user, get by id. Protected: ``/me`` account and profile (Bearer).",
    },
    {
        "name": TAG_WORKOUTS,
        "description": "Workout logs, sessions, and training history.",
    },
    {
        "name": TAG_EXERCISES,
        "description": "Exercise catalog, definitions, and lookups.",
    },
    {
        "name": TAG_HEALTH_METRICS,
        "description": "Body and health measurements over time.",
    },
    {
        "name": TAG_ANALYTICS,
        "description": "Aggregated statistics, trends, and calendar views.",
    },
    {
        "name": TAG_ACHIEVEMENTS,
        "description": "User achievements, progress, and milestones.",
    },
    {
        "name": TAG_CHALLENGES,
        "description": "Fitness challenges and related activity.",
    },
    {
        "name": TAG_EMERGENCY,
        "description": "Emergency and safety-related endpoints (e.g. SOS).",
    },
]
