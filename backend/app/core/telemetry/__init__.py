"""
Error tracking and APM hooks (Sentry, etc.).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import sentry_sdk

if TYPE_CHECKING:
    from fastapi import FastAPI

from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.settings import Settings

logger = logging.getLogger(__name__)


def _sentry_release(settings: Settings) -> str | None:
    if settings.GIT_COMMIT_SHA and str(settings.GIT_COMMIT_SHA).strip():
        sha = str(settings.GIT_COMMIT_SHA).strip()
        return f"fittracker-api@{sha}"
    ver = (settings.APP_VERSION or "").strip()
    if ver:
        return f"fittracker-api@{ver}"
    return None


def _before_send(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any] | None:
    req = event.get("request")
    if isinstance(req, dict):
        headers = req.get("headers")
        if isinstance(headers, dict):
            for key in list(headers.keys()):
                lk = str(key).lower()
                if lk in ("authorization", "cookie", "set-cookie", "x-api-key"):
                    headers[key] = "[Redacted]"
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.SENTRY_DSN:
        return

    traces = 0.1 if settings.ENVIRONMENT == "production" else 1.0

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=_sentry_release(settings),
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=traces,
        profiles_sample_rate=traces,
        send_default_pii=False,
        before_send=_before_send,
    )
    logger.info("Sentry initialized")


def setup_prometheus_metrics(app: "FastAPI", settings: Settings) -> None:
    """Expose Prometheus metrics for scraping (HTTP latency, in-progress, request totals)."""
    if not settings.ENABLE_PROMETHEUS_METRICS:
        return

    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=[
            "^/metrics$",
            "^/api/v1/system/health$",
            "^/docs$",
            "^/redoc$",
            r"^/openapi\.json$",
            r"^/favicon\.ico$",
        ],
    ).instrument(app).expose(app, include_in_schema=False, should_gzip=False)

    logger.info("Prometheus metrics enabled at /metrics")
