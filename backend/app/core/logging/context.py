"""Per-request values for log correlation (async-safe)."""
from __future__ import annotations

from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[int | None] = ContextVar("user_id", default=None)

# Request-scoped HTTP context (best-effort; populated by middleware).
route_var: ContextVar[str | None] = ContextVar("route", default=None)
path_var: ContextVar[str | None] = ContextVar("path", default=None)
method_var: ContextVar[str | None] = ContextVar("method", default=None)
client_ip_var: ContextVar[str | None] = ContextVar("client_ip", default=None)
user_agent_var: ContextVar[str | None] = ContextVar("user_agent", default=None)
