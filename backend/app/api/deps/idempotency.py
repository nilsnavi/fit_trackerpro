"""Optional ``Idempotency-Key`` header for mutation idempotency."""

from __future__ import annotations

from fastapi import Header


async def optional_idempotency_key(
    idempotency_key: str | None = Header(
        None,
        alias="Idempotency-Key",
        description="Client-generated key; duplicate requests replay the first successful response.",
    ),
) -> str | None:
    if idempotency_key is None:
        return None
    stripped = idempotency_key.strip()
    return stripped or None
