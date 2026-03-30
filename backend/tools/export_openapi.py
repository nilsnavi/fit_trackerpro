"""
Export FastAPI OpenAPI schema to a JSON file.

Used by frontend contract checks to detect API drift automatically.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _load_app():
    # Avoid optional startup side-effects and external connections in CI tooling.
    os.environ.setdefault("PYTEST_RUNNING", "1")
    backend_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend_root))
    from app.main import app  # noqa: WPS433 (runtime import is intentional)

    return app


def main() -> int:
    parser = argparse.ArgumentParser(description="Export FastAPI OpenAPI schema as JSON")
    parser.add_argument(
        "--out",
        required=True,
        help="Output path for openapi.json",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation (default: 2)",
    )
    args = parser.parse_args()

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    app = _load_app()
    schema = app.openapi()

    out_path.write_text(
        json.dumps(schema, ensure_ascii=False, indent=args.indent, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
