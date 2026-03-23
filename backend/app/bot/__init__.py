"""
Telegram Bot Module
Handles bot setup, menu button, and WebApp launch
"""
from .main import (
    setup_bot,
    start_bot,
    start_bot_webhook,
    stop_bot,
    set_webapp_menu_button,
    process_webhook_update,
)

__all__ = [
    "setup_bot",
    "start_bot",
    "start_bot_webhook",
    "stop_bot",
    "set_webapp_menu_button",
    "process_webhook_update",
]
