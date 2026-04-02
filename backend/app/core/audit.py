"""
Structured audit logging for security-sensitive user actions.

Logs to logger ``app.audit`` with ``event=audit`` and fields consumed by ``JsonFormatter``.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from starlette.requests import Request

logger = logging.getLogger("app.audit")

# Short action names for filtering (category.entity.verb)
AUTH_TELEGRAM_LOGIN = "auth.telegram_login"
AUTH_REFRESH = "auth.refresh"
AUTH_LOGOUT = "auth.logout"
AUTH_PROFILE_UPDATE = "auth.profile_update"
AUTH_ACCOUNT_DELETE = "auth.account_delete"
WORKOUT_TEMPLATE_CREATE = "workout.template_create"
WORKOUT_TEMPLATE_UPDATE = "workout.template_update"
WORKOUT_TEMPLATE_ARCHIVE = "workout.template_archive"
WORKOUT_TEMPLATE_UNARCHIVE = "workout.template_unarchive"
WORKOUT_TEMPLATE_DELETE = "workout.template_delete"
WORKOUT_START = "workout.start"
WORKOUT_UPDATE = "workout.update"
WORKOUT_COMPLETE = "workout.complete"
ACHIEVEMENT_CLAIM = "achievement.claim"
CHALLENGE_CREATE = "challenge.create"
CHALLENGE_JOIN = "challenge.join"
CHALLENGE_LEAVE = "challenge.leave"


def get_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    if request.client is None:
        return None
    return request.client.host


def _sanitize_value(value: Any, depth: int = 0) -> Any:
    if depth > 3:
        return "<max_depth>"
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        if len(value) > 200:
            return value[:200] + "…"
        return value
    if isinstance(value, dict):
        return {str(k): _sanitize_value(v, depth + 1) for k, v in list(value.items())[:20]}
    if isinstance(value, (list, tuple)):
        seq = [_sanitize_value(x, depth + 1) for x in value[:30]]
        return seq
    return str(value)[:200]


def sanitize_audit_meta(meta: dict | None) -> dict | None:
    if not meta:
        return None
    return _sanitize_value(meta, 0)  # type: ignore[return-value]


def audit_log(
    *,
    action: str,
    user_db_id: int | None = None,
    telegram_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    client_ip: str | None = None,
    meta: dict | None = None,
) -> None:
    """Emit one audit line (JSON when LOG_FORMAT=json)."""
    safe = sanitize_audit_meta(meta)
    extra: dict[str, Any] = {
        "event": "audit",
        "audit_action": action,
        "audit_resource_type": resource_type,
        "audit_resource_id": resource_id,
        "audit_meta": safe,
        "client_ip": client_ip,
    }
    if user_db_id is not None:
        extra["user_id"] = user_db_id
    if telegram_id is not None:
        extra["telegram_id"] = telegram_id
    parts = [f"audit {action}"]
    if user_db_id is not None:
        parts.append(f"uid={user_db_id}")
    if telegram_id is not None:
        parts.append(f"tg={telegram_id}")
    if resource_type and resource_id is not None:
        parts.append(f"{resource_type}={resource_id}")
    if client_ip:
        parts.append(f"ip={client_ip}")
    if safe:
        parts.append("meta=" + json.dumps(safe, ensure_ascii=False, default=str))
    logger.info(" ".join(parts), extra=extra)
