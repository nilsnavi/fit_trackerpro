"""
Telegram WebApp authentication utilities
Handles initData validation and user extraction
"""
import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.settings import settings

# Telegram WebApp initData must be re-validated periodically; stale data is rejected.
INIT_DATA_MAX_AGE_SECONDS = 86400


def parse_init_data(init_data: str) -> Dict[str, Any]:
    """
    Parse initData query string into dictionary

    Args:
        init_data: Raw initData string from Telegram WebApp

    Returns:
        Dictionary of parsed parameters
    """
    params = {}
    for param in init_data.split('&'):
        if '=' in param:
            key, value = param.split('=', 1)
            params[key] = urllib.parse.unquote(value)
    return params


def extract_user_data(parsed_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Extract user data from parsed initData

    Args:
        parsed_data: Parsed initData dictionary

    Returns:
        User data dictionary or None
    """
    import json

    user_json = parsed_data.get('user')
    if not user_json:
        return None

    try:
        return json.loads(user_json)
    except json.JSONDecodeError:
        return None


def validate_init_data(init_data: str, bot_token: str) -> bool:
    """
    Validate Telegram WebApp initData using HMAC-SHA256

    The validation process:
    1. Extract the 'hash' parameter from initData
    2. Create a data-check-string by sorting all parameters (except hash) alphabetically
    3. Create a secret key using HMAC-SHA256 with "WebAppData" as key and bot_token as message
    4. Calculate HMAC-SHA256 of data-check-string using the secret key
    5. Compare calculated hash with the provided hash

    Args:
        init_data: Raw initData string from Telegram WebApp
        bot_token: Bot token from @BotFather

    Returns:
        True if initData is valid, False otherwise
    """
    try:
        # Parse initData
        parsed = parse_init_data(init_data)

        # Extract hash
        received_hash = parsed.pop('hash', None)
        if not received_hash:
            return False

        # Create data-check-string by sorting parameters alphabetically
        data_check_string = '\n'.join(
            f"{k}={v}"
            for k, v in sorted(parsed.items())
        )

        # Create secret key: HMAC-SHA256("WebAppData", bot_token)
        secret_key = hmac.new(
            key=b"WebAppData",
            msg=bot_token.encode(),
            digestmod=hashlib.sha256
        ).digest()

        # Calculate hash: HMAC-SHA256(secret_key, data_check_string)
        calculated_hash = hmac.new(
            key=secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256
        ).hexdigest()

        # Compare hashes
        return hmac.compare_digest(calculated_hash, received_hash)

    except Exception:
        return False


def validate_init_data_with_timestamp(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = INIT_DATA_MAX_AGE_SECONDS,
) -> tuple[bool, Optional[str]]:
    """
    Validate initData with timestamp check

    Args:
        init_data: Raw initData string from Telegram WebApp
        bot_token: Bot token from @BotFather
        max_age_seconds: Maximum age of initData in seconds (default: 24 hours)

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Parse initData
        parsed = parse_init_data(init_data)

        # Check auth_date
        auth_date_str = parsed.get('auth_date')
        if not auth_date_str:
            return False, "В initData отсутствует поле auth_date."

        try:
            auth_date = int(auth_date_str)
        except ValueError:
            return False, "Некорректный формат auth_date в initData."

        # Check timestamp
        current_time = int(datetime.now(timezone.utc).timestamp())
        age = current_time - auth_date

        if age > max_age_seconds:
            return (
                False,
                "Данные Telegram устарели (более 24 часов). "
                "Закройте Mini App и откройте её снова из чата с ботом.",
            )

        if age < -60:  # Allow 1 minute clock skew
            return False, "auth_date в initData указывает на будущее время."

        # Validate hash
        if not validate_init_data(init_data, bot_token):
            return False, "Подпись Telegram initData недействительна."

        return True, None

    except Exception as e:
        return False, f"Ошибка проверки initData: {str(e)}"


def get_user_from_init_data(init_data: str) -> Optional[Dict[str, Any]]:
    """
    Extract user information from initData

    Args:
        init_data: Raw initData string from Telegram WebApp

    Returns:
        User data dictionary with keys: id, username, first_name, last_name, etc.
    """
    parsed = parse_init_data(init_data)
    return extract_user_data(parsed)


def validate_and_get_user(
    init_data: str,
    bot_token: Optional[str] = None,
    max_age_seconds: int = INIT_DATA_MAX_AGE_SECONDS,
) -> tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Validate initData and extract user information

    Args:
        init_data: Raw initData string from Telegram WebApp
        bot_token: Bot token (defaults to settings.TELEGRAM_BOT_TOKEN)
        max_age_seconds: Maximum age of initData in seconds

    Returns:
        Tuple of (is_valid, user_data, error_message)
    """
    token = bot_token or settings.TELEGRAM_BOT_TOKEN

    # Validate initData
    is_valid, error = validate_init_data_with_timestamp(
        init_data, token, max_age_seconds
    )

    if not is_valid:
        return False, None, error

    # Extract user data
    user = get_user_from_init_data(init_data)

    if not user:
        return False, None, "В initData нет данных пользователя (поле user)."

    return True, user, None


def create_auth_token(user_id: int) -> str:
    """
    Create a simple auth token for the user
    In production, use JWT or similar

    Args:
        user_id: Telegram user ID

    Returns:
        Auth token string
    """
    import secrets
    return secrets.token_urlsafe(32)


class TelegramAuthError(Exception):
    """Custom exception for Telegram authentication errors"""
    pass
