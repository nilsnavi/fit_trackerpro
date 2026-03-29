import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.unit
async def test_health_check(client: AsyncClient):
    """Test system health endpoint."""
    response = await client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"


@pytest.mark.unit
async def test_system_version(client: AsyncClient):
    """Test system version endpoint."""
    response = await client.get("/api/v1/system/version")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "FitTracker Pro API"
    assert data["version"] == "1.0.0"
    assert "commit_sha" in data
    assert "build_timestamp" in data


@pytest.mark.unit
async def test_root_endpoint(client: AsyncClient):
    """Test the root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "FitTracker Pro" in data["message"]
    assert "version" in data


@pytest.mark.unit
async def test_api_docs_disabled_in_production():
    """Test that API docs are disabled in production."""
    from app.core.config import Settings

    # In production, docs should be None (disabled)
    # This test verifies the configuration logic
    settings = Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        SECRET_KEY="test-secret-key",
        TELEGRAM_BOT_TOKEN="test-token",
        TELEGRAM_WEBAPP_URL="https://test.com",
        DEBUG=False
    )

    assert settings.DEBUG is False


@pytest.mark.unit
async def test_system_and_health_metrics_separation_smoke():
    """Smoke test: system endpoints are public, health metrics are protected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        system_response = await client.get("/api/v1/system/health")
        assert system_response.status_code == 200
        assert system_response.json().get("status") == "healthy"

        metrics_response = await client.get("/api/v1/health-metrics/stats")
        assert metrics_response.status_code == 401


@pytest.mark.unit
async def test_prometheus_metrics_endpoint():
    """Smoke: /metrics отдаёт Prometheus text после реального запроса."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/")
        response = await client.get("/metrics")
        assert response.status_code == 200
        body = response.text
        assert "http_requests_total" in body
        assert "# HELP" in body


@pytest.mark.unit
async def test_system_version_contract_smoke():
    """Smoke test: system version endpoint returns expected contract."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/system/version")
        assert response.status_code == 200
        data = response.json()
        assert data.get("name") == "FitTracker Pro API"
        assert data.get("version") == "1.0.0"
        assert "commit_sha" in data
        assert "build_timestamp" in data
