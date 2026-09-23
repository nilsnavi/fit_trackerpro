"""Bot API delivery client: failures must surface, never be swallowed (WS1-13).

The API process sends emergency notifications itself (the bot is a separate
process), so this client is the only place where a delivery can be declared
successful. Every branch — HTTP status, network error, non-JSON body and the
``ok: false`` answer of the Bot API — has to turn into ``TelegramDeliveryError``
so the caller can report an honest per-contact result.
"""
from __future__ import annotations

import httpx
import pytest

from app.infrastructure import telegram_sender as sender_module
from app.infrastructure.telegram_sender import (
    BotApiTelegramSender,
    DisabledTelegramSender,
    TelegramDeliveryError,
    _shorten,
    get_telegram_sender,
)
from app.settings import settings
from app.settings.config import _DEV_TELEGRAM_BOT_TOKEN

REAL_TOKEN = "1234567890:AAHrealLookingTokenForTests"


class _FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        *,
        text: str = "{}",
        body: dict | None = None,
        json_error: bool = False,
    ) -> None:
        self.status_code = status_code
        self.text = text
        self._body = body if body is not None else {}
        self._json_error = json_error

    def json(self) -> dict:
        if self._json_error:
            raise ValueError("Expecting value: line 1 column 1 (char 0)")
        return self._body


@pytest.fixture
def bot_api(monkeypatch):
    """Install a fake ``httpx.AsyncClient`` and expose the recorded call."""

    def install(*, response: _FakeResponse | None = None, error: Exception | None = None) -> dict:
        calls: dict = {}

        class FakeAsyncClient:
            def __init__(self, **kwargs) -> None:
                calls["client_kwargs"] = kwargs

            async def __aenter__(self) -> "FakeAsyncClient":
                return self

            async def __aexit__(self, *exc_info) -> bool:
                return False

            async def post(self, url: str, json: dict | None = None, **kwargs):
                calls["url"] = url
                calls["json"] = json
                calls["post_kwargs"] = kwargs
                if error is not None:
                    raise error
                assert response is not None, "test installed neither response nor error"
                return response

        monkeypatch.setattr(sender_module.httpx, "AsyncClient", FakeAsyncClient)
        return calls

    return install


def _sender() -> BotApiTelegramSender:
    return BotApiTelegramSender(REAL_TOKEN, timeout=3.5)


@pytest.mark.asyncio
async def test_sends_message_and_keeps_the_calling_contract(bot_api) -> None:
    calls = bot_api(response=_FakeResponse(200, body={"ok": True}))

    await _sender().send_message(chat_id=42, text="SOS")

    assert calls["url"] == f"https://api.telegram.org/bot{REAL_TOKEN}/sendMessage"
    assert calls["json"] == {"chat_id": 42, "text": "SOS", "disable_web_page_preview": True}
    assert calls["client_kwargs"] == {"timeout": 3.5}


@pytest.mark.asyncio
async def test_http_error_status_is_reported_with_the_body(bot_api) -> None:
    bot_api(response=_FakeResponse(400, text='{"description":"Bad Request"}'))

    with pytest.raises(TelegramDeliveryError) as excinfo:
        await _sender().send_message(chat_id=42, text="SOS")

    assert "HTTP 400" in str(excinfo.value)
    assert "Bad Request" in str(excinfo.value)


@pytest.mark.asyncio
async def test_network_error_is_reported_as_unreachable(bot_api) -> None:
    bot_api(error=httpx.ConnectError("connection refused"))

    with pytest.raises(TelegramDeliveryError) as excinfo:
        await _sender().send_message(chat_id=42, text="SOS")

    assert "unreachable" in str(excinfo.value)
    assert "connection refused" in str(excinfo.value)


@pytest.mark.asyncio
async def test_non_json_success_body_is_reported(bot_api) -> None:
    bot_api(response=_FakeResponse(200, text="<html>gateway</html>", json_error=True))

    with pytest.raises(TelegramDeliveryError, match="non-JSON"):
        await _sender().send_message(chat_id=42, text="SOS")


@pytest.mark.asyncio
async def test_rejected_message_is_reported_with_the_reason(bot_api) -> None:
    bot_api(response=_FakeResponse(200, body={"ok": False, "description": "chat not found"}))

    with pytest.raises(TelegramDeliveryError, match="chat not found"):
        await _sender().send_message(chat_id=42, text="SOS")


@pytest.mark.asyncio
async def test_rejected_message_without_description_names_unknown_error(bot_api) -> None:
    bot_api(response=_FakeResponse(200, body={"ok": False}))

    with pytest.raises(TelegramDeliveryError, match="unknown error"):
        await _sender().send_message(chat_id=42, text="SOS")


@pytest.mark.asyncio
async def test_disabled_sender_explains_the_missing_token() -> None:
    with pytest.raises(TelegramDeliveryError, match="TELEGRAM_BOT_TOKEN"):
        await DisabledTelegramSender().send_message(chat_id=42, text="SOS")


def test_get_sender_returns_disabled_stub_without_a_real_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", _DEV_TELEGRAM_BOT_TOKEN)

    assert isinstance(get_telegram_sender(), DisabledTelegramSender)


def test_get_sender_returns_bot_api_client_with_a_real_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", REAL_TOKEN)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_ENABLED", True)

    assert isinstance(get_telegram_sender(), BotApiTelegramSender)


def test_shorten_keeps_short_values_and_truncates_long_ones() -> None:
    assert _shorten("short") == "short"
    assert _shorten("a" * 301) == "a" * 300 + "…"
    assert len(_shorten("a" * 5000)) == 301
