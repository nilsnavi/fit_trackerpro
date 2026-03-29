"""
Application-wide logging configuration.
"""
import json
import logging
import sys
from typing import TYPE_CHECKING

from app.core.logging.context import request_id_var, user_id_var

if TYPE_CHECKING:
    from app.settings import Settings

# Merged into JSON / propagated from `logger.*(..., extra={...})`.
STRUCTURED_RECORD_KEYS = (
    "event",
    "request_id",
    "user_id",
    "route",
    "path",
    "method",
    "status_code",
    "duration_ms",
)


class RequestContextFilter(logging.Filter):
    """Attach request_id and user_id from contextvars to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        rid = request_id_var.get()
        if rid is not None and not hasattr(record, "request_id"):
            record.request_id = rid
        uid = user_id_var.get()
        if uid is not None and not hasattr(record, "user_id"):
            record.user_id = uid
        return True


class JsonFormatter(logging.Formatter):
    """JSON lines for structured logs when LOG_FORMAT=json."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in STRUCTURED_RECORD_KEYS:
            if hasattr(record, key):
                payload[key] = getattr(record, key)
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
        handler.setFormatter(JsonFormatter())
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
