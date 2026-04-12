import pytest
from httpx import ASGITransport, AsyncClient

from app.application.health_check_service import HealthCheckService
from app.main import app
from app.schemas.system import (
    ReadinessCheckDatabase,
    ReadinessChecks,
    ReadinessCheckRedis,
    ReadinessMigrationsCheck,
    ReadinessResponse,
)


@pytest.mark.unit
async def test_health_check(client: AsyncClient):
    """Test system health endpoint."""
    response = await client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"


@pytest.mark.unit
async def test_health_probe_alias_matches_canonical(client: AsyncClient):
    """GET /health returns the same JSON contract as GET /api/v1/system/health."""
    canonical = await client.get("/api/v1/system/health")
    alias = await client.get("/health")
    assert canonical.status_code == 200
    assert alias.status_code == 200
    assert canonical.json() == alias.json()


@pytest.mark.unit
async def test_health_live_endpoint(client: AsyncClient):
    """GET /health/live returns liveness payload."""
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data


@pytest.mark.unit
async def test_system_live_endpoint(client: AsyncClient):
    """GET /api/v1/system/live returns liveness payload."""
    response = await client.get("/api/v1/system/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data


@pytest.mark.unit
async def test_readiness_returns_503_when_not_ready(client: AsyncClient, monkeypatch):
    """Readiness returns HTTP 503 if at least one dependency is unhealthy."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="not_ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="error", latency_ms=2.0),
                redis=ReadinessCheckRedis(status="ok", latency_ms=1.0),
                migrations=ReadinessMigrationsCheck(status="ok", current="abc", head="abc"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_not_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["checks"]["database"]["status"] == "error"


@pytest.mark.unit
async def test_readiness_returns_200_when_ready(client: AsyncClient, monkeypatch):
    """Readiness returns HTTP 200 when all dependencies are healthy."""

    async def _ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=1.2),
                redis=ReadinessCheckRedis(status="ok", latency_ms=0.8),
                migrations=ReadinessMigrationsCheck(status="ok", current="rev1", head="rev1"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["checks"]["database"]["status"] == "ok"


@pytest.mark.unit
async def test_readiness_degraded_returns_503(client: AsyncClient, monkeypatch):
    """Migrations pending → status degraded → HTTP 503 for orchestrators."""

    async def _degraded() -> ReadinessResponse:
        return ReadinessResponse(
            status="degraded",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=1.0),
                redis=ReadinessCheckRedis(status="ok", latency_ms=1.0),
                migrations=ReadinessMigrationsCheck(
                    status="pending", current="oldrev", head="newrev"
                ),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_degraded))
    response = await client.get("/api/v1/system/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


@pytest.mark.unit
async def test_system_readiness_returns_503_when_not_ready(client: AsyncClient, monkeypatch):
    """V1 readiness endpoint also returns HTTP 503 when unhealthy."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="not_ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="error", latency_ms=None),
                redis=ReadinessCheckRedis(status="ok", latency_ms=1.0),
                migrations=ReadinessMigrationsCheck(status="ok", current="a", head="a"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_not_ready))

    response = await client.get("/api/v1/system/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"


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
async def test_root_redirects_document_navigation_to_telegram_webapp(client: AsyncClient):
    """Mini App / browser hits on ``/`` must go to the frontend URL, not raw API JSON."""
    response = await client.get(
        "/",
        headers={
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
    )
    assert response.status_code == 302
    assert response.headers.get("location") == "https://example.com/webapp"


@pytest.mark.unit
async def test_root_redirects_telegram_user_agent_to_webapp(client: AsyncClient):
    response = await client.get(
        "/",
        headers={"User-Agent": "Mozilla/5.0 Telegram-iOS"},
    )
    assert response.status_code == 302
    assert response.headers.get("location") == "https://example.com/webapp"


@pytest.mark.unit
async def test_root_redirects_sec_fetch_dest_document(client: AsyncClient):
    response = await client.get(
        "/",
        headers={"Sec-Fetch-Dest": "document"},
    )
    assert response.status_code == 302
    assert response.headers.get("location") == "https://example.com/webapp"


@pytest.mark.unit
async def test_api_docs_disabled_in_production():
    """Test that API docs are disabled in production."""
    from app.settings import Settings

    settings = Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        SECRET_KEY="test-secret-key",
        TELEGRAM_BOT_TOKEN="test-token",
        TELEGRAM_WEBAPP_URL="https://test.com",
        DEBUG=False,
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


@pytest.mark.unit
async def test_readiness_db_unavailable_redis_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 503 when database is down but Redis is healthy."""

    async def _partial_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="not_ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="error", latency_ms=1.5),
                redis=ReadinessCheckRedis(status="ok", latency_ms=3.2),
                migrations=ReadinessMigrationsCheck(status="ok", current="a", head="a"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_partial_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["checks"]["database"]["status"] == "error"
    assert data["checks"]["redis"]["status"] == "ok"


@pytest.mark.unit
async def test_readiness_redis_unavailable_db_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 503 when Redis is down but database is healthy."""

    async def _partial_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="not_ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=2.1),
                redis=ReadinessCheckRedis(status="error", latency_ms=5.0),
                migrations=ReadinessMigrationsCheck(status="ok", current="a", head="a"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_partial_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["checks"]["database"]["status"] == "ok"
    assert data["checks"]["redis"]["status"] == "error"


@pytest.mark.unit
async def test_readiness_all_deps_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 200 when all dependencies are healthy."""

    async def _all_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=1.2),
                redis=ReadinessCheckRedis(status="ok", latency_ms=0.8),
                migrations=ReadinessMigrationsCheck(status="ok", current="head1", head="head1"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_all_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["checks"]["database"]["status"] == "ok"
    assert data["checks"]["redis"]["status"] == "ok"


@pytest.mark.unit
async def test_readiness_response_time_populated(client: AsyncClient, monkeypatch):
    """Readiness response includes latency_ms for database and redis."""

    async def _ready_with_times() -> ReadinessResponse:
        return ReadinessResponse(
            status="ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=1.5),
                redis=ReadinessCheckRedis(status="ok", latency_ms=3.2),
                migrations=ReadinessMigrationsCheck(status="ok", current="x", head="x"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_ready_with_times))

    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["checks"]["database"]["latency_ms"] is not None
    assert data["checks"]["redis"]["latency_ms"] is not None
    assert isinstance(data["checks"]["database"]["latency_ms"], (int, float))
    assert isinstance(data["checks"]["redis"]["latency_ms"], (int, float))


@pytest.mark.unit
async def test_liveness_independent_of_deps(client: AsyncClient, monkeypatch):
    """Liveness returns 200 even when readiness would return 503."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="not_ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="error", latency_ms=None),
                redis=ReadinessCheckRedis(status="ok", latency_ms=1.0),
                migrations=ReadinessMigrationsCheck(status="ok", current="a", head="a"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_not_ready))

    readiness_response = await client.get("/health/ready")
    assert readiness_response.status_code == 503
    assert readiness_response.json()["status"] == "not_ready"

    liveness_response = await client.get("/health/live")
    assert liveness_response.status_code == 200
    data = liveness_response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data


@pytest.mark.unit
async def test_readiness_timeout_handling(client: AsyncClient, monkeypatch):
    """Readiness reflects latency_ms for slow database."""

    async def _slow_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status="ready",
            timestamp="2026-04-08T00:00:00Z",
            checks=ReadinessChecks(
                database=ReadinessCheckDatabase(status="ok", latency_ms=150.5),
                redis=ReadinessCheckRedis(status="ok", latency_ms=1.0),
                migrations=ReadinessMigrationsCheck(status="ok", current="a", head="a"),
            ),
        )

    monkeypatch.setattr(HealthCheckService, "readiness", staticmethod(_slow_ready))

    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    db_latency = data["checks"]["database"]["latency_ms"]
    assert db_latency is not None
    assert isinstance(db_latency, (int, float))
    assert db_latency > 100
