"""Compatibility entry point for the canonical reference-data seeder.

The old version of this module contained a second hand-maintained exercise
catalog.  Keep the command for existing E2E/local scripts, but delegate to the
same manifest + NDJSON pipeline used by production so it cannot create a stale
parallel catalog.

Run from the ``backend`` directory::

    python -m scripts.seed_exercises
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from app.cli.seed_reference_data import DEFAULT_DATA_DIR, apply_reference_data


def _data_dir() -> Path:
    return Path(os.getenv("REFERENCE_DATA_DIR") or DEFAULT_DATA_DIR).resolve()


async def seed_if_needed() -> int:
    """Apply the full catalog; name retained for backwards-compatible callers."""

    data_dir = _data_dir()
    result = await apply_reference_data(data_dir=data_dir, dry_run=False, check=False)
    print(f"Applied canonical exercise reference data from {data_dir}.")
    return result


def main() -> None:
    asyncio.run(seed_if_needed())


if __name__ == "__main__":
    main()
