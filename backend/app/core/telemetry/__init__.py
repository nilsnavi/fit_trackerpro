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
    explicit = (settings.SENTRY_RELEASE or "").strip()
    if explicit:
        return explicit
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


def _before_send_transaction(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any] | None:
    """
    Drop low-signal transactions (health probes, metrics) to reduce noise/cost.

    Sentry transaction events are not guaranteed to include HTTP request info, so we primarily
    rely on the transaction name which Sentry derives from the framework/router.
    """
    tx = str(event.get("transaction") or "")
    if (
        tx.endswith(("/health", "/metrics"))
        or "/api/v1/system/health" in tx
        or "/api/v1/system/ready" in tx
        or tx.endswith("/health/ready")
    ):
        return None
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.SENTRY_DSN:
        return

    default_traces = 0.1 if settings.ENVIRONMENT == "production" else 1.0
    traces = settings.SENTRY_TRACES_SAMPLE_RATE if settings.SENTRY_TRACES_SAMPLE_RATE is not None else default_traces
    profiles = settings.SENTRY_PROFILES_SAMPLE_RATE if settings.SENTRY_PROFILES_SAMPLE_RATE is not None else traces

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=_sentry_release(settings),
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        sample_rate=settings.SENTRY_ERROR_SAMPLE_RATE,
        traces_sample_rate=traces,
        profiles_sample_rate=profiles,
        send_default_pii=False,
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
    )
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("service", "fittracker-backend")
        scope.set_tag("component", "backend")
        scope.set_tag("app", "fittracker")
        if settings.GIT_COMMIT_SHA:
            scope.set_tag("git_sha", settings.GIT_COMMIT_SHA)
        if settings.BUILD_TIMESTAMP:
            scope.set_tag("build_timestamp", settings.BUILD_TIMESTAMP)
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
            "^/health$",
            "^/health/live$",
            "^/health/ready$",
            "^/api/v1/system/health$",
            "^/api/v1/system/live$",
            "^/api/v1/system/ready$",
            "^/api/v1/system/version$",
            "^/docs$",
            "^/redoc$",
            r"^/openapi\.json$",
            r"^/favicon\.ico$",
        ],
    ).instrument(app).expose(app, include_in_schema=False, should_gzip=False)

    logger.info("Prometheus metrics enabled at /metrics")
