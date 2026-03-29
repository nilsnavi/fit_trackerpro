"""Standard JSON error envelope for API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    """Stable machine-oriented code plus human-readable message."""

    code: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Stable error identifier",
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Human-readable description",
    )
    details: list[dict[str, Any]] | dict[str, Any] | None = Field(
        default=None,
        description="Optional structured details (e.g. validation issues)",
    )


class ErrorEnvelope(BaseModel):
    error: ErrorBody
    request_id: str | None = Field(
        default=None,
        max_length=128,
        description="Server request / correlation id (matches X-Request-ID) for support and logs",
    )
