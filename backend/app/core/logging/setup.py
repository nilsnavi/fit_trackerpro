"""
Application-wide logging configuration.
"""
import json
import logging
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings


class JsonFormatter(logging.Formatter):
    """Minimal JSON lines for structured logs when LOG_FORMAT=json."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(settings: "Settings") -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    root = logging.getLogger()

    if settings.LOG_FORMAT.lower() == "json":
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(JsonFormatter())
        root.handlers.clear()
        root.addHandler(handler)
    else:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )
        root.setLevel(level)
        return

    root.setLevel(level)
