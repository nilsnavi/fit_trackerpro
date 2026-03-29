import json
import logging
import uuid

import pytest
from httpx import AsyncClient
from starlette.requests import Request

from app.core.logging.context import request_id_var, user_id_var
from app.core.logging.setup import ContextTextFormatter, JsonFormatter, RequestContextFilter
from app.core.request_identity import user_id_from_authorization_header
from app.main import app
from app.middleware.request_logging import _incoming_request_id, _matched_route_template


def _minimal_http_scope(
    path: str = "/",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> dict:
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("testserver", 80),
    }


@pytest.mark.unit
def test_incoming_request_id_strips_and_rejects_blank():
    req = Request(_minimal_http_scope(headers=[(b"x-request-id", b"  abc-1  ")]))
    assert _incoming_request_id(req) == "abc-1"
    req2 = Request(_minimal_http_scope(headers=[(b"x-request-id", b"   ")]))
    assert _incoming_request_id(req2) is None


@pytest.mark.unit
def test_matched_route_template_without_route():
    req = Request(_minimal_http_scope())
    assert _matched_route_template(req) is None


@pytest.mark.unit
def test_matched_route_template_empty_path_attr():
    class RouteStub:
        path = ""

    scope = _minimal_http_scope()
    scope["route"] = RouteStub()
    req = Request(scope)
    assert _matched_route_template(req) is None


@pytest.mark.unit
def test_user_id_none_when_bearer_token_blank():
    req = Request(
        _minimal_http_scope(headers=[(b"authorization", b"Bearer   ")])
    )
    assert user_id_from_authorization_header(req) is None


@pytest.mark.unit
async def test_x_request_id_echoed(client: AsyncClient):
    response = await client.get("/", headers={"X-Request-ID": "client-trace-1"})
    assert response.status_code == 200
    assert response.headers.get("x-request-id") == "client-trace-1"


@pytest.mark.unit
async def test_x_request_id_generated_when_absent(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    rid = response.headers.get("x-request-id")
    assert rid is not None
    uuid.UUID(rid)


@pytest.mark.unit
async def test_access_log_record_has_core_fields(caplog, client: AsyncClient):
    caplog.set_level(logging.INFO, logger="app.http")
    response = await client.get("/api/v1/system/health")
    assert response.status_code == 200
    http_records = [r for r in caplog.records if getattr(r, "event", None) == "http_request"]
    assert len(http_records) >= 1
    rec = http_records[-1]
    assert rec.method == "GET"
    assert rec.path == "/api/v1/system/health"
    assert rec.status_code == 200
    assert isinstance(rec.duration_ms, (int, float))
    assert rec.request_id == response.headers.get("x-request-id")
    assert rec.route == "/api/v1/system/health"


@pytest.mark.unit
async def test_authenticated_request_sets_user_id_on_access_log(caplog, authenticated_client: AsyncClient):
    caplog.set_level(logging.INFO, logger="app.http")
    response = await authenticated_client.get("/api/v1/users/me")
    assert response.status_code == 200
    http_records = [r for r in caplog.records if getattr(r, "event", None) == "http_request"]
    me_logs = [r for r in http_records if r.path == "/api/v1/users/me"]
    assert me_logs
    assert me_logs[-1].user_id == 123456789


@pytest.mark.unit
async def test_request_logging_middleware_registered():
    """Smoke: outer logging middleware is present on the ASGI stack."""
    names = [m.cls.__name__ for m in app.user_middleware]
    assert "StructuredRequestLoggingMiddleware" in names


@pytest.mark.unit
def test_json_formatter_includes_structured_fields():
    fmt = JsonFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="x.py",
        lineno=1,
        msg="http_request",
        args=(),
        exc_info=None,
    )
    record.event = "http_request"
    record.request_id = "r1"
    record.duration_ms = 2.5
    record.user_id = None
    line = fmt.format(record)
    data = json.loads(line)
    assert data["message"] == "http_request"
    assert data["event"] == "http_request"
    assert data["request_id"] == "r1"
    assert data["duration_ms"] == 2.5
    assert data["user_id"] is None


@pytest.mark.unit
def test_request_context_filter_binds_from_contextvars():
    flt = RequestContextFilter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="x.py",
        lineno=1,
        msg="x",
        args=(),
        exc_info=None,
    )
    t1 = request_id_var.set("ctx-rid")
    t2 = user_id_var.set(99)
    try:
        assert flt.filter(record) is True
        assert record.request_id == "ctx-rid"
        assert record.user_id == 99
    finally:
        user_id_var.reset(t2)
        request_id_var.reset(t1)


@pytest.mark.unit
def test_context_text_formatter_fills_missing_correlation():
    fmt = ContextTextFormatter(
        fmt="%(message)s rid=%(request_id)s uid=%(user_id)s",
    )
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="x.py",
        lineno=1,
        msg="ping",
        args=(),
        exc_info=None,
    )
    out = fmt.format(record)
    assert "ping" in out
    assert "rid=-" in out
    assert "uid=-" in out
