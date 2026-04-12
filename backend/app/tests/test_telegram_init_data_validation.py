"""Unit tests for Telegram WebApp initData HMAC verification (no HTTP)."""

from __future__ import annotations

import time

import pytest

from app.infrastructure.telegram_auth import (
    INIT_DATA_MAX_AGE_SECONDS,
    validate_init_data,
    validate_init_data_with_timestamp,
)
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


@pytest.mark.unit
def test_validate_init_data_accepts_valid_signature(mock_telegram_user: dict) -> None:
    init = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=mock_telegram_user)
    assert validate_init_data(init, settings.TELEGRAM_BOT_TOKEN) is True


@pytest.mark.unit
def test_validate_init_data_rejects_invalid_signature(mock_telegram_user: dict) -> None:
    init = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user=mock_telegram_user,
        invalid_hash=True,
    )
    assert validate_init_data(init, settings.TELEGRAM_BOT_TOKEN) is False


@pytest.mark.unit
def test_validate_init_data_with_timestamp_rejects_stale_init_data(mock_telegram_user: dict) -> None:
    old = int(time.time()) - INIT_DATA_MAX_AGE_SECONDS - 3600
    init = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user=mock_telegram_user,
        auth_date=old,
    )
    ok, err = validate_init_data_with_timestamp(
        init,
        settings.TELEGRAM_BOT_TOKEN,
        max_age_seconds=INIT_DATA_MAX_AGE_SECONDS,
    )
    assert ok is False
    assert err is not None
    assert "24" in err or "устарел" in err


@pytest.mark.unit
def test_validate_init_data_with_timestamp_rejects_bad_hash_before_success(mock_telegram_user: dict) -> None:
    init = build_init_data(
        bot_token=settings.TELEGRAM_BOT_TOKEN,
        user=mock_telegram_user,
        invalid_hash=True,
    )
    ok, err = validate_init_data_with_timestamp(init, settings.TELEGRAM_BOT_TOKEN)
    assert ok is False
    assert err is not None
    assert "Подпись" in err or "недействительна" in err
