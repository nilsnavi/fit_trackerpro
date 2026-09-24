"""Outbound Telegram messages sent from the API process.

The bot runs as its own process (webhook in production, polling in dev), so the
API cannot reuse the bot's ``Application`` instance. Emergency notifications
therefore call the Bot API over HTTPS directly.

Delivery is only possible to chats that have already contacted the bot, which is
why every contact needs an explicit ``telegram_chat_id`` (see
``EmergencyContact``). Failures never raise into the request path: the caller
receives an exception and reports an honest per-contact error instead of a fake
success.
"""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)

_BOT_API_BASE = "https://api.telegram.org"
_DEFAULT_TIMEOUT_SECONDS = 10.0


class TelegramDeliveryError(RuntimeError):
    """Raised when a message cannot be delivered through the Bot API."""


@runtime_checkable
class TelegramSender(Protocol):
    """Minimal delivery interface so tests can substitute a fake sender."""

    async def send_message(self, chat_id: int, text: str) -> None:
        """Send ``text`` to ``chat_id``; raise TelegramDeliveryError on failure."""
        ...


class DisabledTelegramSender:
    """Used when no real bot token is configured (dev/test defaults)."""

    async def send_message(self, chat_id: int, text: str) -> None:
        raise TelegramDeliveryError(
            "Telegram bot is not configured on the server (TELEGRAM_BOT_TOKEN)"
        )


class BotApiTelegramSender:
    """Small Bot API client for a single message."""

    def __init__(self, token: str, *, timeout: float = _DEFAULT_TIMEOUT_SECONDS) -> None:
        self._endpoint = f"{_BOT_API_BASE}/bot{token}/sendMessage"
        self._timeout = timeout

    async def send_message(self, chat_id: int, text: str) -> None:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(self._endpoint, json=payload)
        except httpx.HTTPError as exc:  # network error, timeout, DNS, ...
            raise TelegramDeliveryError(f"Telegram API is unreachable: {exc}") from exc

        if response.status_code != httpx.codes.OK:
            raise TelegramDeliveryError(
                f"Telegram API returned HTTP {response.status_code}: "
                f"{_shorten(response.text)}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise TelegramDeliveryError("Telegram API returned a non-JSON response") from exc

        if not body.get("ok"):
            description = body.get("description") or "unknown error"
            raise TelegramDeliveryError(f"Telegram API rejected the message: {description}")


def _shorten(value: str, limit: int = 300) -> str:
    return value if len(value) <= limit else f"{value[:limit]}…"


def get_telegram_sender() -> TelegramSender:
    """Return a sender for the configured bot, or a disabled stub in dev/test."""
    if not settings.telegram_bot_configured:
        logger.warning(
            "TELEGRAM_BOT_TOKEN is not configured (or still the dev placeholder): "
            "Telegram notifications will be reported as undelivered"
        )
        return DisabledTelegramSender()
    return BotApiTelegramSender(settings.TELEGRAM_BOT_TOKEN)
