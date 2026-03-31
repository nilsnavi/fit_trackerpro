"""
Application-wide logging configuration.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.core.logging.context import (
    client_ip_var,
    method_var,
    path_var,
    request_id_var,
    route_var,
    user_agent_var,
    user_id_var,
)

if TYPE_CHECKING:
    from app.settings import Settings

# Merged into JSON / propagated from `logger.*(..., extra={...})`.
STRUCTURED_RECORD_KEYS = (
    "event",
    "request_id",
    "correlation_id",
    "user_id",
    "telegram_id",
    "route",
    "path",
    "method",
    "status_code",
    "duration_ms",
    "audit_action",
    "audit_resource_type",
    "audit_resource_id",
    "audit_meta",
    "client_ip",
    "user_agent",
)

_LOG_RECORD_BUILTINS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
}


class RequestContextFilter(logging.Filter):
    """Attach request_id and other request context from contextvars to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        rid = request_id_var.get()
        if rid is not None:
            if not hasattr(record, "request_id"):
                record.request_id = rid
            if not hasattr(record, "correlation_id"):
                record.correlation_id = rid
        uid = user_id_var.get()
        if uid is not None and not hasattr(record, "user_id"):
            record.user_id = uid

        route = route_var.get()
        if route is not None and not hasattr(record, "route"):
            record.route = route
        path = path_var.get()
        if path is not None and not hasattr(record, "path"):
            record.path = path
        method = method_var.get()
        if method is not None and not hasattr(record, "method"):
            record.method = method
        ip = client_ip_var.get()
        if ip is not None and not hasattr(record, "client_ip"):
            record.client_ip = ip
        ua = user_agent_var.get()
        if ua is not None and not hasattr(record, "user_agent"):
            record.user_agent = ua
        return True


class JsonFormatter(logging.Formatter):
    """JSON lines for structured logs when LOG_FORMAT=json."""

    def __init__(
        self,
        *,
        service: str,
        environment: str,
        version: str,
        git_commit_sha: str | None,
        build_timestamp: str | None,
    ) -> None:
        super().__init__()
        self._service = service
        self._environment = environment
        self._version = version
        self._git_commit_sha = git_commit_sha
        self._build_timestamp = build_timestamp

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
        payload: dict = {
            "@timestamp": ts,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self._service,
            "environment": self._environment,
            "version": self._version,
        }
        if self._git_commit_sha:
            payload["git_commit_sha"] = self._git_commit_sha
        if self._build_timestamp:
            payload["build_timestamp"] = self._build_timestamp

        for key in STRUCTURED_RECORD_KEYS:
            if hasattr(record, key):
                payload[key] = getattr(record, key)

        # Include additional `extra=...` fields (best-effort) for debugging/ops,
        # without polluting the top-level schema with arbitrary keys.
        extra_fields: dict[str, object] = {}
        for k, v in record.__dict__.items():
            if k in _LOG_RECORD_BUILTINS:
                continue
            if k in payload:
                continue
            if k.startswith("_"):
                continue
            extra_fields[k] = v
            if len(extra_fields) >= 50:
                break
        if extra_fields:
            payload["fields"] = extra_fields

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


class ContextTextFormatter(logging.Formatter):
    """Text logs with optional request correlation when inside a request."""

    def format(self, record: logging.LogRecord) -> str:
        rid = getattr(record, "request_id", None)
        uid = getattr(record, "user_id", None)
        record.request_id = rid if rid is not None else "-"
        record.user_id = uid if uid is not None else "-"
        return super().format(record)


def configure_logging(settings: "Settings") -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    root = logging.getLogger()
    ctx_filter = RequestContextFilter()

    if settings.LOG_FORMAT.lower() == "json":
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(
            JsonFormatter(
                service=settings.APP_NAME,
                environment=settings.ENVIRONMENT,
                version=settings.APP_VERSION,
                git_commit_sha=settings.GIT_COMMIT_SHA,
                build_timestamp=settings.BUILD_TIMESTAMP,
            )
        )
        handler.addFilter(ctx_filter)
        root.handlers.clear()
        root.addHandler(handler)
    else:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(
            ContextTextFormatter(
                fmt="%(asctime)s %(levelname)s [%(name)s] [rid=%(request_id)s uid=%(user_id)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        handler.addFilter(ctx_filter)
        root.handlers.clear()
        root.addHandler(handler)

    root.setLevel(level)
