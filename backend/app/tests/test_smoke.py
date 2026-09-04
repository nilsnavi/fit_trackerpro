"""
Smoke tests: приложение поднимается, маршруты зарегистрированы, health отвечает 200.
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.main import app


def _registered_paths(application: FastAPI) -> set[str]:
    """Public API paths, independent of FastAPI's internal router representation."""
    return set(application.openapi().get("paths", {}))


@pytest.mark.smoke
async def test_backend_smoke():
    """Приложение создаётся, ключевые маршруты есть, liveness health — 200."""
    assert isinstance(app, FastAPI)
    assert app.title == "FitTracker Pro API"

    paths = _registered_paths(app)
    assert "/api/v1/system/health" in paths
    assert "/api/v1/system/ready" in paths
    assert "/api/v1/system/version" in paths
    # Регрессия: отключение include_router сильно уменьшит число маршрутов
    assert len(paths) >= 40

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "healthy"
