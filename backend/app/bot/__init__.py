"""
Telegram Bot Module
Handles bot setup, menu button, and WebApp launch
"""
from .main import (
    process_webhook_update,
    set_webapp_menu_button,
    setup_bot,
    start_bot,
    start_bot_webhook,
    stop_bot,
)

__all__ = [
    "setup_bot",
    "start_bot",
    "start_bot_webhook",
    "stop_bot",
    "set_webapp_menu_button",
    "process_webhook_update",
]
