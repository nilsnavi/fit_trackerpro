import pytest
from httpx import AsyncClient


@pytest.mark.unit
async def test_api_responses_include_security_headers(client: AsyncClient):
    response = await client.get("/api/v1/system/health")
    assert response.status_code == 200
    h = response.headers
    assert h.get("x-content-type-options") == "nosniff"
    assert h.get("x-frame-options") == "DENY"
    assert h.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "permissions-policy" in h


@pytest.mark.unit
async def test_root_includes_security_headers(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.headers.get("x-frame-options") == "DENY"
