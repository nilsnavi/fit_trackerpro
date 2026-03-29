import re
from pathlib import Path

import pytest

from app.settings import Settings


def _parse_env_example_keys(path: Path) -> set[str]:
    keys: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Z][A-Z0-9_]*)\s*=", line)
        if match:
            keys.add(match.group(1))
    return keys


@pytest.mark.unit
def test_backend_env_example_matches_settings_fields():
    """Prevent drift between backend .env.example and Settings."""
    backend_root = Path(__file__).resolve().parents[2]
    env_example_path = backend_root / ".env.example"

    env_example_keys = _parse_env_example_keys(env_example_path)
    settings_keys = {
        key
        for key in Settings.model_fields.keys()
        if key.upper() == key and not key.startswith("model_")
    }

    missing_in_settings = sorted(env_example_keys - settings_keys)
    missing_in_env_example = sorted(settings_keys - env_example_keys)

    assert not missing_in_settings, (
        "Variables present in backend/.env.example but missing in Settings: "
        + ", ".join(missing_in_settings)
    )
    assert not missing_in_env_example, (
        "Variables present in Settings but missing in backend/.env.example: "
        + ", ".join(missing_in_env_example)
    )
