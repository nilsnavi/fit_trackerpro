import pytest
from pydantic import ValidationError

from app.settings import Settings


def _valid_settings_payload() -> dict:
    return {
        "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
        "SECRET_KEY": "test-secret-key-1234567890",
        "TELEGRAM_BOT_TOKEN": "123456:ABCDEF_test_token",
        "TELEGRAM_WEBAPP_URL": "https://localhost:3000",
    }


@pytest.mark.unit
@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("DATABASE_URL", ""),
        ("SECRET_KEY", "   "),
        ("TELEGRAM_BOT_TOKEN", ""),
        ("TELEGRAM_WEBAPP_URL", " "),
    ],
)
def test_required_env_fields_cannot_be_empty(field_name: str, invalid_value: str):
    payload = _valid_settings_payload()
    payload[field_name] = invalid_value

    with pytest.raises(ValidationError):
        Settings(**payload)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("TELEGRAM_BOT_TOKEN", "your_telegram_bot_token_here"),
        ("TELEGRAM_WEBAPP_URL", "https://your-domain.com"),
    ],
)
def test_telegram_env_fields_reject_placeholder_values(field_name: str, invalid_value: str):
    payload = _valid_settings_payload()
    payload[field_name] = invalid_value

    with pytest.raises(ValidationError):
        Settings(**payload)
