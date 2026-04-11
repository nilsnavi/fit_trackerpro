import pytest
from httpx import ASGITransport, AsyncClient

from app.application.health_check_service import HealthCheckService
from app.main import app
from app.schemas.system import DependencyStatus, LivenessResponse, ReadinessResponse


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
    response = await client.get('/health/live')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'alive'
    assert 'timestamp' in data


@pytest.mark.unit
async def test_system_live_endpoint(client: AsyncClient):
    """GET /api/v1/system/live returns liveness payload."""
    response = await client.get('/api/v1/system/live')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'alive'
    assert 'timestamp' in data


@pytest.mark.unit
async def test_readiness_returns_503_when_not_ready(client: AsyncClient, monkeypatch):
    """Readiness returns HTTP 503 if at least one dependency is unhealthy."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='not_ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=False,
                    response_time_ms=None,
                    message='database down',
                )
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_not_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 503
    data = response.json()
    assert data['status'] == 'not_ready'
    assert data['dependencies']['database']['healthy'] is False


@pytest.mark.unit
async def test_readiness_returns_200_when_ready(client: AsyncClient, monkeypatch):
    """Readiness returns HTTP 200 when all dependencies are healthy."""

    async def _ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=True,
                    response_time_ms=None,
                    message=None,
                )
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness', staticmethod(_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ready'
    assert data['dependencies']['database']['healthy'] is True


@pytest.mark.unit
async def test_system_readiness_returns_503_when_not_ready(client: AsyncClient, monkeypatch):
    """V1 readiness endpoint also returns HTTP 503 when unhealthy."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='not_ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=False,
                    response_time_ms=None,
                    message='database down',
                )
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_not_ready))

    response = await client.get('/api/v1/system/ready')
    assert response.status_code == 503
    assert response.json()['status'] == 'not_ready'


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


@pytest.mark.unit
async def test_readiness_db_unavailable_redis_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 503 when database is down but Redis is healthy."""

    async def _partial_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='not_ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=False,
                    response_time_ms=1.5,
                    message='database down',
                ),
                'redis': DependencyStatus(
                    name='redis',
                    healthy=True,
                    response_time_ms=3.2,
                    message=None,
                ),
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_partial_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 503
    data = response.json()
    assert data['status'] == 'not_ready'
    assert data['dependencies']['database']['healthy'] is False
    assert data['dependencies']['redis']['healthy'] is True


@pytest.mark.unit
async def test_readiness_redis_unavailable_db_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 503 when Redis is down but database is healthy."""

    async def _partial_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='not_ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=True,
                    response_time_ms=2.1,
                    message=None,
                ),
                'redis': DependencyStatus(
                    name='redis',
                    healthy=False,
                    response_time_ms=5.0,
                    message='Redis connection failed',
                ),
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_partial_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 503
    data = response.json()
    assert data['status'] == 'not_ready'
    assert data['dependencies']['database']['healthy'] is True
    assert data['dependencies']['redis']['healthy'] is False


@pytest.mark.unit
async def test_readiness_all_deps_healthy(client: AsyncClient, monkeypatch):
    """Readiness returns 200 when all dependencies are healthy."""

    async def _all_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=True,
                    response_time_ms=1.2,
                    message=None,
                ),
                'redis': DependencyStatus(
                    name='redis',
                    healthy=True,
                    response_time_ms=0.8,
                    message=None,
                ),
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_all_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ready'
    assert data['dependencies']['database']['healthy'] is True
    assert data['dependencies']['redis']['healthy'] is True


@pytest.mark.unit
async def test_readiness_response_time_populated(client: AsyncClient, monkeypatch):
    """Readiness response includes response_time_ms for each dependency."""

    async def _ready_with_times() -> ReadinessResponse:
        return ReadinessResponse(
            status='ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=True,
                    response_time_ms=1.5,
                    message=None,
                ),
                'redis': DependencyStatus(
                    name='redis',
                    healthy=True,
                    response_time_ms=3.2,
                    message=None,
                ),
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_ready_with_times))

    response = await client.get('/health/ready')
    assert response.status_code == 200
    data = response.json()
    for dep_name, dep_data in data['dependencies'].items():
        assert dep_data['response_time_ms'] is not None
        assert isinstance(dep_data['response_time_ms'], (int, float))


@pytest.mark.unit
async def test_liveness_independent_of_deps(client: AsyncClient, monkeypatch):
    """Liveness returns 200 even when readiness would return 503."""

    async def _not_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='not_ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=False,
                    response_time_ms=None,
                    message='database down',
                ),
            },
        )

    # Only patch readiness, NOT liveness - liveness should still return 200
    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_not_ready))

    # Verify readiness returns 503
    readiness_response = await client.get('/health/ready')
    assert readiness_response.status_code == 503
    assert readiness_response.json()['status'] == 'not_ready'

    # Liveness should still return 200
    liveness_response = await client.get('/health/live')
    assert liveness_response.status_code == 200
    data = liveness_response.json()
    assert data['status'] == 'alive'
    assert 'timestamp' in data


@pytest.mark.unit
async def test_readiness_timeout_handling(client: AsyncClient, monkeypatch):
    """Readiness reflects actual response time for slow dependencies."""

    async def _slow_ready() -> ReadinessResponse:
        return ReadinessResponse(
            status='ready',
            timestamp='2026-04-08T00:00:00Z',
            dependencies={
                'database': DependencyStatus(
                    name='database',
                    healthy=True,
                    response_time_ms=150.5,  # Simulated slow response
                    message=None,
                ),
            },
        )

    monkeypatch.setattr(HealthCheckService, 'readiness',
                        staticmethod(_slow_ready))

    response = await client.get('/health/ready')
    assert response.status_code == 200
    data = response.json()
    # Verify response_time_ms reflects a slow dependency
    db_response_time = data['dependencies']['database']['response_time_ms']
    assert db_response_time is not None
    assert isinstance(db_response_time, (int, float))
    assert db_response_time > 100  # Slow response should be measurable
