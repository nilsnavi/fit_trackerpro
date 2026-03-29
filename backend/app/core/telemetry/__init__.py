"""
Error tracking and APM hooks (Sentry, etc.).
"""
from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import Settings

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
