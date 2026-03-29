"""Standard JSON error envelope for API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    """Stable machine-oriented code plus human-readable message."""

    code: str = Field(..., description="Stable error identifier")
    message: str = Field(..., description="Human-readable description")
    details: list[dict[str, Any]] | dict[str, Any] | None = Field(
        default=None,
        description="Optional structured details (e.g. validation issues)",
    )


class ErrorEnvelope(BaseModel):
    error: ErrorBody
    request_id: str | None = Field(
        default=None,
        description="Server request / correlation id (matches X-Request-ID) for support and logs",
    )
