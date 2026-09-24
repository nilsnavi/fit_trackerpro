"""Minimal SPEC-006 metrics (SPEC §60).

Only four counters, no new monitoring subsystem. They register on the default
``prometheus_client`` registry, which is the one the existing ``/metrics``
endpoint serves. Registration failures (duplicate import in the same process)
must never break a workout completion, hence the defensive wrapper.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_METRIC_NAMES = (
    "progression_evaluations_total",
    "progression_recommendations_total",
    "progression_deloads_total",
    "progression_errors_total",
)

# In-process fallback/mirror so tests can assert without scraping /metrics.
_MEMORY_COUNTS: dict[str, dict[str, int]] = {name: {} for name in _METRIC_NAMES}

_COUNTERS: dict[str, object] = {}


def _get_counter(name: str):
    if name in _COUNTERS:
        return _COUNTERS[name]
    try:
        from prometheus_client import Counter

        counter = Counter(name, f"FitTracker SPEC-006 counter: {name}", labelnames=("outcome",))
    except Exception:  # pragma: no cover - prometheus optional / already registered
        counter = None
    _COUNTERS[name] = counter
    return counter


def record_progression_metric(name: str, outcome: str = "ok") -> None:
    """Increment one progression counter (non-fatal on any failure)."""
    if name not in _MEMORY_COUNTS:
        return
    bucket = _MEMORY_COUNTS[name]
    bucket[outcome] = bucket.get(outcome, 0) + 1
    counter = _get_counter(name)
    if counter is None:
        return
    try:
        counter.labels(outcome=outcome).inc()
    except Exception:  # pragma: no cover - metrics must never break a request
        logger.debug("progression_metric_failed", extra={"event": "progression_metric_failed"})


def progression_metrics_snapshot() -> dict[str, dict[str, int]]:
    """Copy of in-process counters (used by tests and diagnostics)."""
    return {name: dict(values) for name, values in _MEMORY_COUNTS.items()}


def reset_progression_metrics() -> None:
    for values in _MEMORY_COUNTS.values():
        values.clear()
