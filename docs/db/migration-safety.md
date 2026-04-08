# Database Migration Safety Guide

> **Scope:** Alembic migrations in `database/migrations/versions/`  
> **Goal:** Zero-downtime schema evolution with guaranteed rollback capability

---

## Table of Contents

1. [Migration Rules (Backward-Compatible Changes)](#1-migration-rules)  
2. [Rollback Procedure — Step by Step](#2-rollback-procedure)  
3. [Creating a New Migration](#3-creating-a-new-migration)  
4. [CI Pipeline — Migration Stage](#4-ci-pipeline)  
5. [Danger Pattern Reference](#5-danger-pattern-reference)  
6. [Tooling Reference](#6-tooling-reference)

---

## 1. Migration Rules

Every migration **must** follow these rules before merging.

### ✅ Allowed — backward-compatible

| Change | Why it's safe |
|---|---|
| `ADD COLUMN ... DEFAULT x` | Old app code ignores new column |
| `ADD COLUMN ... NULL` | Old code doesn't write, value stays NULL |
| `CREATE INDEX CONCURRENTLY` | Non-blocking on PostgreSQL |
| `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` | Skips full-table scan |
| `CREATE TABLE` | New table, old code never queries it |
| `DROP INDEX IF EXISTS` | Non-blocking |
| Add new CHECK / FK on NEW table | No existing rows affected |

### ❌ Forbidden — breaking changes

| Change | Risk | Safe Alternative |
|---|---|---|
| `DROP COLUMN` | Old app crashes on missing column | Deprecate → remove in 2nd migration after full deploy |
| `RENAME COLUMN` | Old code references old name | Add new column + backfill, remove old in phase 2 |
| `ALTER COLUMN TYPE` | Data loss or table lock | Add new column, migrate data, swap, delete old |
| `NOT NULL` without `DEFAULT` | Fails on non-empty tables | Add with `DEFAULT`, backfill, then add NOT NULL constraint |
| `DROP TABLE` | Data loss | Archive first, drop after N weeks of zero traffic |

### Rule: every migration must have `downgrade()`

The `downgrade()` function must reverse every DDL statement in `upgrade()`.  
Running `python backend/tools/test_migrations.py --validate-chain` will fail CI if
a non-root migration has a trivial (empty/pass) `downgrade()`.

---

## 2. Rollback Procedure

### Pre-flight checklist

- [ ] Confirm a database backup was taken **before** the migration ran
- [ ] Know the target revision ID (run `alembic history --indicate-current`)
- [ ] Freeze deployments during rollback
- [ ] Coordinate with the team if multiple app instances are running (blue/green)

### Step-by-step

```bash
# 1. Activate the Python virtualenv
source .venv/bin/activate          # Linux/macOS
# or: .\.venv\Scripts\Activate.ps1  # Windows

# 2. Validate the chain first
python backend/tools/test_migrations.py --validate-chain

# 3. Check what's currently deployed
cd database/migrations
alembic current
alembic history --indicate-current

# 4a. Roll back ONE step (most common)
CONFIRM_ROLLBACK=yes ../../scripts/rollback_migration.sh

# 4b. Roll back to a specific revision
CONFIRM_ROLLBACK=yes ../../scripts/rollback_migration.sh c3a9d7e11f2b

# 4c. Roll back everything to base (nuclear option)
CONFIRM_ROLLBACK=yes ../../scripts/rollback_migration.sh base

# 5. Verify health
curl -f https://your-app/api/health
```

**Windows PowerShell equivalent:**

```powershell
.\scripts\rollback_migration.ps1 -Confirm
# or to a specific revision:
.\scripts\rollback_migration.ps1 -Target c3a9d7e11f2b -Confirm
```

### After rollback

1. Redeploy the previous application version (matching DB schema)
2. Confirm health endpoint returns `200`
3. Open incident ticket documenting what went wrong
4. Fix the migration and re-test via CI before re-deploying

---

## 3. Creating a New Migration

```bash
cd database/migrations

# Auto-generate from model diff
alembic revision --autogenerate -m "describe_your_change"

# Or create an empty migration
alembic revision -m "describe_your_change"
```

**Mandatory items in a new migration file:**

```python
"""Short description of the change

Revision ID: <auto>
Revises: <parent>
Create Date: YYYY-MM-DD HH:MM:SS
"""
from alembic import op
import sqlalchemy as sa

revision = "xxxxxxxx"
down_revision = "yyyyyyyy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS for idempotency
    op.execute("""
        ALTER TABLE my_table
        ADD COLUMN IF NOT EXISTS new_col VARCHAR(50) NOT NULL DEFAULT 'pending'
    """)


def downgrade() -> None:
    # MUST reverse every change in upgrade()
    op.execute("ALTER TABLE my_table DROP COLUMN IF EXISTS new_col")
```

**Checklist before opening a MR:**

- [ ] `downgrade()` reverses all DDL changes  
- [ ] No `DROP COLUMN` / `RENAME COLUMN` without a deprecation migration first  
- [ ] NOT NULL only added with a `DEFAULT` value  
- [ ] Large indexes use `CONCURRENTLY` (requires a separate transaction outside alembic `op.execute`)  
- [ ] `python backend/tools/test_migrations.py --validate-chain` reports `PASSED`

---

## 4. CI Pipeline

Two jobs run in the `db_migrations` stage (`.gitlab-ci.yml`):

| Job | What it does |
|---|---|
| `test_migrations_fresh_db` | Validates chain integrity, then runs `alembic upgrade head` on a clean PostgreSQL 16 instance |
| `test_migration_rollback` | Runs upgrade → head, downgrade → -1, downgrade → base, upgrade → head (full round-trip) |

Both jobs depend on `lint_backend` and `backend_dep_consistency` passing first.

A PostgreSQL 16 Alpine service container is started automatically via GitLab CI `services:`.

### Running the same checks locally

```bash
# Chain validation only (no DB required)
python backend/tools/test_migrations.py --validate-chain

# Full round-trip test (requires PostgreSQL)
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/fittracker_test"
cd database/migrations
alembic upgrade head
alembic downgrade base
alembic upgrade head
```

---

## 5. Danger Pattern Reference

`test_migrations.py` static-analyzes each migration file and raises warnings/errors
for these patterns:

| Pattern | Severity | Reason |
|---|---|---|
| `DROP COLUMN` without `IF EXISTS` | Warning | Fails if column already removed |
| `DROP TABLE` without `IF EXISTS` | Warning | Idempotency broken |
| `ADD COLUMN … NOT NULL` without `DEFAULT` | Danger | Fails on tables with existing rows |
| `RENAME COLUMN` | Danger | Old app code references old name |
| `RENAME TABLE … TO` | Danger | All existing queries break |
| `ALTER COLUMN … TYPE` | Warning | May require full table rewrite + lock |
| Trivial `downgrade() → pass` | Error | Rollback impossible |

---

## 6. Tooling Reference

| Tool/Script | Purpose |
|---|---|
| `backend/tools/test_migrations.py --validate-chain` | Static chain & safety analysis, no DB required |
| `scripts/rollback_migration.sh [revision]` | Safe rollback with confirmation gate (Linux/macOS) |
| `scripts/rollback_migration.ps1 [-Target rev] -Confirm` | Safe rollback (Windows PowerShell) |
| `backend/tools/bootstrap_alembic_version.py` | Insert `alembic_version` into legacy DBs that predate Alembic |
| `alembic history --indicate-current` | Show full migration history with current marker |
| `alembic current` | Print currently applied revision |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic downgrade -1` | Roll back one migration |
| `alembic downgrade base` | Roll back all migrations to empty DB |

---

*Last updated: 2026-04-08*
