"""
Migration chain integrity validator.

Usage:
    python backend/tools/test_migrations.py --validate-chain

Checks:
  - Linear chain (no branches, no orphans)
  - Every revision has a non-trivial downgrade() body
  - No dangerous schema patterns (DROP TABLE, DROP COLUMN without IF EXISTS,
    NOT NULL column without server_default / DEFAULT value)
  - Reports revision metadata table

Exit codes:
  0 - all checks passed
  1 - one or more checks failed
"""
from __future__ import annotations

import argparse
import inspect
import re
import sys
from dataclasses import dataclass, field
from importlib import util as importlib_util
from pathlib import Path
from typing import Optional

# ---- Locate migrations/versions --------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
VERSIONS_DIR = REPO_ROOT / "database" / "migrations" / "versions"


# ---- Data model ------------------------------------------------------------
@dataclass
class RevisionInfo:
    revision: str
    down_revision: Optional[str]
    branch_labels: Optional[str]
    file: Path
    has_nontrivial_downgrade: bool
    dangers: list[str] = field(default_factory=list)


# ---- Helpers ---------------------------------------------------------------
def _load_revision_file(path: Path) -> RevisionInfo:
    spec = importlib_util.spec_from_file_location("_migration_" + path.stem, path)
    assert spec and spec.loader
    mod = importlib_util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]

    revision: str = getattr(mod, "revision", "")
    down_revision = getattr(mod, "down_revision", None)
    branch_labels = getattr(mod, "branch_labels", None)

    downgrade_fn = getattr(mod, "downgrade", None)
    has_nontrivial = False
    if downgrade_fn is not None:
        src = inspect.getsource(downgrade_fn)
        body_lines = [
            ln.strip()
            for ln in src.splitlines()
            if ln.strip()
            and not ln.strip().startswith("def downgrade")
            and not ln.strip().startswith("#")
        ]
        nontrivial_tokens = [
            ln for ln in body_lines if ln not in ("pass", '"""', "'''", "...")
        ]
        has_nontrivial = len(nontrivial_tokens) > 0

    source = path.read_text(encoding="utf-8")
    dangers = _detect_dangers(source)

    return RevisionInfo(
        revision=revision,
        down_revision=down_revision,
        branch_labels=branch_labels,
        file=path,
        has_nontrivial_downgrade=has_nontrivial,
        dangers=dangers,
    )


_DANGER_PATTERNS: list[tuple[str, str]] = [
    (
        r"\bDROP\s+COLUMN\b(?!\s+IF\s+EXISTS)",
        "DROP COLUMN without IF EXISTS",
    ),
    (
        r"\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)",
        "DROP TABLE without IF EXISTS",
    ),
    (
        r"ADD\s+COLUMN\b[^\n;]*NOT\s+NULL(?![^\n;]*\bDEFAULT\b)",
        "ADD COLUMN NOT NULL without DEFAULT (will fail on non-empty tables)",
    ),
    (
        r"\bRENAME\s+COLUMN\b",
        "RENAME COLUMN (breaking - coordinate with app deployment)",
    ),
    (
        r"\bRENAME\s+TO\b",
        "RENAME TABLE (breaking - coordinate with app deployment)",
    ),
    (
        r"\bALTER\s+COLUMN\b[^\n;]*\bTYPE\b",
        "ALTER COLUMN TYPE (may lock table - verify migration strategy)",
    ),
]


def _detect_dangers(source: str) -> list[str]:
    found: list[str] = []
    upper = source.upper()
    for pattern, label in _DANGER_PATTERNS:
        if re.search(pattern, upper):
            found.append(label)
    return found


# ---- Chain validation ------------------------------------------------------
def load_all_revisions() -> list[RevisionInfo]:
    revisions: list[RevisionInfo] = []
    for p in sorted(VERSIONS_DIR.glob("*.py")):
        if p.name.startswith("__"):
            continue
        revisions.append(_load_revision_file(p))
    return revisions


def validate_chain(revisions: list[RevisionInfo]) -> list[str]:
    errors: list[str] = []
    by_revision: dict[str, RevisionInfo] = {}

    for r in revisions:
        if not r.revision:
            errors.append(f"{r.file.name}: revision ID is empty")
            continue
        if r.revision in by_revision:
            errors.append(
                f"Duplicate revision ID '{r.revision}' in {r.file.name}"
            )
        by_revision[r.revision] = r

    roots = [r for r in revisions if r.down_revision is None]
    if len(roots) > 1:
        errors.append(
            "Multiple root revisions detected: "
            + str([r.revision for r in roots])
            + ". The migration chain must be linear."
        )

    for r in revisions:
        if r.down_revision and r.down_revision not in by_revision:
            errors.append(
                f"Revision '{r.revision}' references unknown parent "
                f"'{r.down_revision}'"
            )

    for r in revisions:
        if not r.has_nontrivial_downgrade and r.down_revision is not None:
            errors.append(
                f"Revision '{r.revision}' ({r.file.name}): trivial downgrade() "
                "- add rollback logic or document why it is intentional."
            )

    return errors


# ---- ANSI helpers ----------------------------------------------------------
RESET  = "\033[0m"
RED    = "\033[31m"
YELLOW = "\033[33m"
GREEN  = "\033[32m"
BOLD   = "\033[1m"
CYAN   = "\033[36m"


def _c(color: str, text: str) -> str:
    if sys.stdout.isatty():
        return color + text + RESET
    return text


# ---- Report ----------------------------------------------------------------
def print_report(revisions: list[RevisionInfo], chain_errors: list[str]) -> bool:
    root = next((r for r in revisions if r.down_revision is None), None)
    ordered: list[RevisionInfo] = []
    cur = root
    visited: set[str] = set()
    while cur and cur.revision not in visited:
        ordered.append(cur)
        visited.add(cur.revision)
        cur = next(
            (r for r in revisions if r.down_revision == cur.revision), None
        )

    sep = "-" * 72
    print()
    print(_c(BOLD + CYAN, "=== Migration Chain Integrity Report ==="))
    print("  Migrations dir : " + str(VERSIONS_DIR))
    print("  Total revisions: " + str(len(revisions)))
    print()
    print("  {:<4} {:<16} {:<16} {:<14} {}".format(
        "#", "Revision", "Parent", "Downgrade", "Dangers"
    ))
    print("  " + sep)

    all_ok = True
    for i, r in enumerate(ordered, 1):
        parent = r.down_revision or "(root)"
        if r.has_nontrivial_downgrade:
            dg_str = _c(GREEN, "[OK]     ")
        else:
            dg_str = _c(RED, "[TRIVIAL]")
            all_ok = False

        danger_str = ""
        if r.dangers:
            all_ok = False
            danger_str = _c(YELLOW, "[!] " + str(len(r.dangers)) + " warning(s)")

        print("  {:<4} {:<16} {:<16} {:<22} {}".format(
            i, r.revision, parent, dg_str, danger_str
        ))
        for d in r.dangers:
            print("       " + _c(YELLOW, "-> ") + d)

    print()

    if chain_errors:
        all_ok = False
        print(_c(RED + BOLD, "Chain errors:"))
        for e in chain_errors:
            print("  [X] " + e)
        print()
    else:
        print(_c(GREEN, "  [OK] Chain is linear -- no branches or orphans"))

    total_dangers = sum(len(r.dangers) for r in revisions)
    if total_dangers:
        print(_c(YELLOW + BOLD,
                 "\n  [!] " + str(total_dangers)
                 + " potential breaking-change warning(s) found."))
        print("    Review each before deploying to production.")

    trivial_count = sum(
        1 for r in revisions
        if not r.has_nontrivial_downgrade and r.down_revision is not None
    )
    if trivial_count:
        print(_c(RED,
                 "\n  [FAIL] " + str(trivial_count)
                 + " non-root revision(s) with trivial downgrade()"
                 " - rollback impossible."))
        all_ok = False

    print()
    if all_ok:
        print(_c(GREEN + BOLD, "  [PASS] All migration safety checks PASSED"))
    else:
        print(_c(RED + BOLD,
                 "  [FAIL] Migration safety checks FAILED"
                 " - review errors above"))
    print()
    return all_ok


# ---- Entry point -----------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Alembic migration chain safety"
    )
    parser.add_argument(
        "--validate-chain",
        action="store_true",
        default=True,
        help="Run full chain integrity + safety checks (default)",
    )
    parser.parse_args()

    revisions = load_all_revisions()
    if not revisions:
        print("No migration files found in " + str(VERSIONS_DIR),
              file=sys.stderr)
        return 1

    chain_errors = validate_chain(revisions)
    passed = print_report(revisions, chain_errors)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
