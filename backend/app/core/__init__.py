"""
Application core: config, security, logging, telemetry.

Prefer importing from submodules, e.g. ``app.core.config``, ``app.core.security``.
"""

from app.core.config import Settings, settings

__all__ = ["Settings", "settings"]
