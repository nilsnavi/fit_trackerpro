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


@pytest.mark.unit
def test_production_rejects_development_default_secrets():
    """Built-in dev defaults must not be accepted when ENVIRONMENT=production."""
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production")


@pytest.mark.unit
def test_production_accepts_realistic_overrides():
    payload = {
        "ENVIRONMENT": "production",
        "DATABASE_URL": "postgresql+asyncpg://user:pass@db.example.com:5432/app",
        "SECRET_KEY": "x" * 32,
        "TELEGRAM_BOT_TOKEN": "123456789:AAHproduction_token_not_equal_to_dev_default",
        "TELEGRAM_WEBAPP_URL": "https://fittrackpro.ru",
        "ALLOWED_ORIGINS": "https://fittrackpro.ru",
        "DEBUG": False,
    }
    s = Settings(**payload)
    assert s.ENVIRONMENT == "production"
    assert s.DEBUG is False


@pytest.mark.unit
def test_production_rejects_empty_allowed_origins():
    payload = {
        "ENVIRONMENT": "production",
        "DATABASE_URL": "postgresql+asyncpg://user:pass@db.example.com:5432/app",
        "SECRET_KEY": "x" * 32,
        "TELEGRAM_BOT_TOKEN": "123456789:AAHproduction_token_not_equal_to_dev_default",
        "TELEGRAM_WEBAPP_URL": "https://fittrackpro.ru",
        "ALLOWED_ORIGINS": " , , ",
        "DEBUG": False,
    }
    with pytest.raises(ValidationError):
        Settings(**payload)


@pytest.mark.unit
def test_admin_user_ids_parses_comma_separated_string():
    payload = _valid_settings_payload()
    payload["ADMIN_USER_IDS"] = "123,456,789"

    s = Settings(**payload)
    assert s.ADMIN_USER_IDS == [123, 456, 789]


@pytest.mark.unit
def test_admin_user_ids_rejects_non_numeric_values():
    payload = _valid_settings_payload()
    payload["ADMIN_USER_IDS"] = "123,abc,789"

    with pytest.raises(ValidationError):
        Settings(**payload)


@pytest.mark.unit
@pytest.mark.parametrize(
    "token",
    [
        "123456789:AAHproduction_token_not_equal_to_dev_default",
        "987654321:BBxyz-AbCdEfGhIjKlMnOpQrStUvWxYz_12",
        "100000000:CC_very_long_token_string_for_real_bot",
    ],
)
def test_telegram_bot_token_valid_formats_accepted(token: str):
    """Tokens matching {digits}:{alphanum_and_dashes} must be accepted."""
    payload = _valid_settings_payload()
    payload["TELEGRAM_BOT_TOKEN"] = token
    # Should not raise
    s = Settings(**payload)
    assert s.TELEGRAM_BOT_TOKEN == token


@pytest.mark.unit
@pytest.mark.parametrize(
    "token",
    [
        "",              # empty
        "   ",           # whitespace only
        "your_telegram_bot_token_here",  # placeholder
    ],
)
def test_telegram_bot_token_invalid_values_rejected(token: str):
    """Invalid or placeholder tokens must raise ValidationError."""
    payload = _valid_settings_payload()
    payload["TELEGRAM_BOT_TOKEN"] = token
    with pytest.raises(ValidationError):
        Settings(**payload)


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "https://fittrackpro.ru",
        "https://app.example.com",
        "https://t.me/myapp",
    ],
)
def test_telegram_webapp_url_valid_values_accepted(url: str):
    """Valid non-placeholder TELEGRAM_WEBAPP_URL values must be accepted."""
    payload = _valid_settings_payload()
    payload["TELEGRAM_WEBAPP_URL"] = url
    s = Settings(**payload)
    assert s.TELEGRAM_WEBAPP_URL == url
