"""
Regression tests for app.core.security.tokens.

Locked in during the python-jose -> PyJWT migration (WS1-4): the module is the
single place that encodes/decodes JWTs, so these cases must keep passing
regardless of the underlying JWT library.
"""
from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.security.tokens import (
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.settings import settings


def test_access_token_round_trip() -> None:
    token = create_access_token(4242)

    assert isinstance(token, str)
    assert verify_token(token) == 4242


def test_refresh_token_round_trip() -> None:
    token = create_refresh_token(4242, "4d31a3df-53ef-4b7e-98bc-868c21216024")

    assert verify_token(token, token_type="refresh") == 4242
    assert verify_token(token, token_type="refresh", include_generation=True) == (
        4242,
        "4d31a3df-53ef-4b7e-98bc-868c21216024",
    )


def test_token_types_are_not_interchangeable() -> None:
    access = create_access_token(4242)
    refresh = create_refresh_token(4242)

    assert verify_token(refresh) is None
    assert verify_token(access, token_type="refresh") is None


def test_expired_token_is_rejected() -> None:
    token = create_access_token(4242, expires_delta=timedelta(seconds=-1))

    assert verify_token(token) is None


def test_tampered_token_is_rejected() -> None:
    token = create_access_token(4242)
    header, payload, signature = token.split(".")
    tampered = f"{header}.{payload}.{signature[:-2]}xx"

    assert verify_token(tampered) is None


def test_token_signed_with_another_secret_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    token = create_access_token(4242)

    monkeypatch.setattr(settings, "SECRET_KEY", "another-secret-key-at-least-32-characters")

    assert verify_token(token) is None


def test_non_jwt_input_is_rejected() -> None:
    assert verify_token("not-a-jwt") is None
    assert verify_token("") is None
