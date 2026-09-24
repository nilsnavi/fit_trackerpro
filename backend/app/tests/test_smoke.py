"""
Smoke tests: приложение поднимается, маршруты зарегистрированы, health отвечает 200.
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.main import app


def _registered_paths(application: FastAPI) -> set[str]:
    """Все зарегистрированные path: из OpenAPI-схемы и верхнего уровня маршрутов."""
    # OpenAPI раскрывает include_router; инфра-зонды (/health и т.п.) объявлены
    # с include_in_schema=False, поэтому добавляем и плоские маршруты приложения.
    # Итерация по application.routes начиная со starlette>=0.50 не видит вложенные
    # _IncludedRouter (у них нет атрибута path) — потому и нужен union.
    paths = set(application.openapi()["paths"].keys())
    paths.update(
        route.path
        for route in application.routes
        if getattr(route, "path", None) is not None
    )
    return paths


@pytest.mark.smoke
async def test_backend_smoke():
    """Приложение создаётся, ключевые маршруты есть, liveness health — 200."""
    assert isinstance(app, FastAPI)
    assert app.title == "FitTracker Pro API"

    paths = _registered_paths(app)
    assert "/health" in paths
    assert "/health/ready" in paths
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
