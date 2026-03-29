"""
Canonical application settings (environment-backed).

Import ``settings`` (singleton) or ``Settings`` (class) from ``app.settings``.
Implementation lives in ``app.settings.config``.
"""

from app.settings.config import BACKEND_DIR, Settings, settings

__all__ = ["BACKEND_DIR", "Settings", "settings"]
