#!/usr/bin/env bash
# ============================================================================
# rollback_migration.sh — Zero-downtime DB rollback helper
#
# Usage:
#   ./scripts/rollback_migration.sh [TARGET_REVISION]
#
# Arguments:
#   TARGET_REVISION  Alembic revision ID to downgrade to, e.g. "c3a9d7e11f2b"
#                    Defaults to "-1" (one step back from current HEAD).
#
# Safety gates:
#   1. Requires CONFIRM_ROLLBACK=yes environment variable to prevent accidents.
#   2. Checks DATABASE_URL is set and points to PostgreSQL.
#   3. Prints current and target revision before executing.
#   4. Runs validate-chain check via test_migrations.py first.
#
# Example — roll back one step:
#   CONFIRM_ROLLBACK=yes ./scripts/rollback_migration.sh
#
# Example — roll back to a specific revision:
#   CONFIRM_ROLLBACK=yes ./scripts/rollback_migration.sh c3a9d7e11f2b
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/database/migrations"
TOOLS_DIR="$REPO_ROOT/backend/tools"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'

die()  { echo -e "${RED}ERROR: $*${RESET}" >&2; exit 1; }
warn() { echo -e "${YELLOW}WARN:  $*${RESET}" >&2; }
info() { echo -e "${CYAN}INFO:  $*${RESET}"; }
ok()   { echo -e "${GREEN}OK:    $*${RESET}"; }

TARGET="${1:--1}"

# ─── Gate 1: explicit confirmation ─────────────────────────────────────────
if [[ "${CONFIRM_ROLLBACK:-}" != "yes" ]]; then
  die "Set CONFIRM_ROLLBACK=yes to execute rollback.\n\n  CONFIRM_ROLLBACK=yes $0 [TARGET_REVISION]"
fi

# ─── Gate 2: DATABASE_URL must be set and PostgreSQL ───────────────────────
: "${DATABASE_URL:?DATABASE_URL environment variable is not set}"
if [[ "$DATABASE_URL" != postgresql* && "$DATABASE_URL" != asyncpg* ]]; then
  die "DATABASE_URL does not look like a PostgreSQL URL: $DATABASE_URL"
fi

# ─── Gate 3: prerequisite tools ────────────────────────────────────────────
command -v alembic >/dev/null 2>&1 || die "alembic not found in PATH. Activate the Python virtualenv."
command -v python  >/dev/null 2>&1 || die "python  not found in PATH."

# ─── Step 1: validate chain integrity ──────────────────────────────────────
info "Step 1/4 — Validating migration chain integrity…"
python "$TOOLS_DIR/test_migrations.py" --validate-chain || die "Migration chain validation failed. Fix errors before rolling back."
ok "Chain validation passed."

# ─── Step 2: print current revision ────────────────────────────────────────
info "Step 2/4 — Checking current DB revision…"
cd "$MIGRATIONS_DIR"
CURRENT=$(alembic current 2>&1)
echo "$CURRENT"

# ─── Step 3: show the planned downgrade ────────────────────────────────────
info "Step 3/4 — Target revision: ${YELLOW}${TARGET}${RESET}"
warn "This operation CANNOT be undone automatically. Ensure you have a DB backup."
echo ""
alembic history --indicate-current 2>/dev/null | head -20 || true
echo ""

# Final confirmation prompt when running interactively
if [[ -t 0 ]]; then
  echo -e "${YELLOW}Proceed with downgrade to '${TARGET}'? [yes/n]:${RESET} "
  read -r REPLY
  [[ "$REPLY" == "yes" ]] || die "Rollback aborted by user."
fi

# ─── Step 4: execute downgrade ─────────────────────────────────────────────
info "Step 4/4 — Running: alembic downgrade ${TARGET}"
alembic downgrade "$TARGET"

NEW_CURRENT=$(alembic current 2>&1)
ok "Rollback complete. Current revision: ${NEW_CURRENT}"
echo ""
echo -e "${GREEN}Next steps:${RESET}"
echo "  1. Verify application health: curl -f https://your-app/api/health"
echo "  2. Check logs for schema-related errors."
echo "  3. If re-applying the migration: CONFIRM_ROLLBACK=yes alembic upgrade head"
