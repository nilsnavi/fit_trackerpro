"""
Helpers for Telegram WebApp initData (tests only).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import quote


def build_init_data(
    *,
    bot_token: str,
    user: dict[str, Any],
    auth_date: int | None = None,
    invalid_hash: bool = False,
) -> str:
    """
    Build a signed initData query string compatible with app.utils.telegram_auth.
    """
    if auth_date is None:
        auth_date = int(time.time())
    user_json = json.dumps(user, separators=(",", ":"), ensure_ascii=False)
    fields = {"auth_date": str(auth_date), "user": user_json}
    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    digest = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if invalid_hash:
        digest = "0" * 64
    return (
        f"user={quote(user_json, safe='')}"
        f"&auth_date={auth_date}"
        f"&hash={digest}"
    )
