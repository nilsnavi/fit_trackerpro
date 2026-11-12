"""Prometheus counter for emergency notification delivery failures.

Used by the ``EmergencyDeliveryFailures`` alert. Registration is defensive:
a missing/duplicate ``prometheus_client`` must never break an emergency request.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_METRIC_NAME = "emergency_delivery_failures_total"
_MEMORY: dict[str, int] = {}
_COUNTER: object | None = None
_initialized = False


def _counter():
    global _COUNTER, _initialized
    if _initialized:
        return _COUNTER
    _initialized = True
    try:
        from prometheus_client import Counter

        _COUNTER = Counter(
            _METRIC_NAME,
            "Emergency notification delivery failures",
            labelnames=("reason",),
        )
    except Exception:  # pragma: no cover - prometheus optional / already registered
        _COUNTER = None
    return _COUNTER


def record_emergency_delivery_failure(reason: str) -> None:
    """Count a failed emergency delivery (``reason``: unlinked|delivery_error)."""
    _MEMORY[reason] = _MEMORY.get(reason, 0) + 1
    counter = _counter()
    if counter is None:
        return
    try:
        counter.labels(reason=reason).inc()
    except Exception:  # pragma: no cover
        logger.debug("emergency metric increment failed", exc_info=True)


def get_emergency_failure_counts() -> dict[str, int]:
    """In-process mirror for tests (no /metrics scraping required)."""
    return dict(_MEMORY)