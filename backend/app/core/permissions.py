"""Who may do what — one place for the admin rule (the API is the only authority)."""
from __future__ import annotations

from typing import Any

from app.settings import settings


def is_admin_user(user: Any) -> bool:
    """Admins are configured by Telegram id in ``ADMIN_USER_IDS``."""
    telegram_id = getattr(user, "telegram_id", None)
    if telegram_id is None:
        return False
    return int(telegram_id) in set(getattr(settings, "ADMIN_USER_IDS", []) or [])
