"""
Минимальный счётчик HTTP при ``ENABLE_PROMETHEUS_METRICS=false``.

Совместим с ``prometheus_fastapi_instrumentator``: тот же ``http_requests_total`` и порядок
лейблов ``handler``, ``method``, ``status`` (группировка 2xx/3xx/4xx/5xx), чтобы правила
Prometheus (например HighErrorRate) продолжали работать. Отдельный ``CollectorRegistry``,
чтобы не конфликтовать с полным инструментированием при перезапуске в том же процессе.
"""
from __future__ import annotations

import logging
import re
from typing import Callable

from fastapi import FastAPI, Request, Response
from prometheus_client import CollectorRegistry, Counter, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import PlainTextResponse

logger = logging.getLogger(__name__)

_REGISTRY = CollectorRegistry()

# Те же исключения, что у полного Instrumentator в ``setup_prometheus_metrics``.
_EXCLUDED: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"^/metrics$",
        r"^/health$",
        r"^/health/live$",
        r"^/health/ready$",
        r"^/api/v1/system/health$",
        r"^/api/v1/system/live$",
        r"^/api/v1/system/ready$",
        r"^/api/v1/system/version$",
        r"^/docs$",
        r"^/redoc$",
        r"^/openapi\.json$",
        r"^/favicon\.ico$",
    )
)

_HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total number of HTTP requests (minimal exporter; full metrics disabled).",
    labelnames=("handler", "method", "status"),
    registry=_REGISTRY,
)


def _status_class(code: int) -> str:
    if code >= 500:
        return "5xx"
    if code >= 400:
        return "4xx"
    if code >= 300:
        return "3xx"
    return "2xx"


def _handler_label(request: Request) -> str:
    route = request.scope.get("route")
    if route is not None:
        p = getattr(route, "path", None)
        if isinstance(p, str) and p:
            return p
    return request.url.path or "/"


def _should_skip(path: str) -> bool:
    return any(p.match(path) for p in _EXCLUDED)


class _MinimalHttpMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if _should_skip(path):
            return await call_next(request)
        response = await call_next(request)
        _HTTP_REQUESTS_TOTAL.labels(
            _handler_label(request),
            request.method.upper(),
            _status_class(response.status_code),
        ).inc()
        return response


def install_minimal_prometheus_metrics(app: FastAPI) -> None:
    """Счётчик ``http_requests_total`` + ``GET /metrics`` без histogram/latency."""
    if getattr(app.state, "_minimal_prometheus_installed", False):
        return
    app.state._minimal_prometheus_installed = True

    app.add_middleware(_MinimalHttpMetricsMiddleware)

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint(_request: Request) -> Response:
        data = generate_latest(_REGISTRY)
        return PlainTextResponse(content=data, media_type="text/plain; version=0.0.4; charset=utf-8")

    logger.info("Minimal Prometheus metrics at /metrics (ENABLE_PROMETHEUS_METRICS=false)")
