# Cleanup Changelog - 2026-04-06

Commit: `5da1c21` (main)

## Scope
Architecture consistency cleanup without business logic rewrites.

## 1) Prisma leftovers in root toolchain
Problem:
- Root Node layer still declared Prisma packages, which implied an alternative DB schema authority.

Change:
- Removed `prisma` and `@prisma/client` from root [package.json](../../package.json).
- Regenerated [package-lock.json](../../package-lock.json) to remove Prisma dependency tree.
- Deleted legacy archive file [docs/db/legacy/schema.prisma](../db/legacy/schema.prisma).

Risk reduction:
- Eliminates accidental Prisma usage in orchestration layer.
- Removes ambiguity around schema ownership and migration workflow.

## 2) DB source-of-truth alignment
Problem:
- Documentation/runbooks contained stale Prisma-centric wording that contradicted active SQLAlchemy + Alembic governance.

Change:
- Updated [docs/db/schema-governance.md](../db/schema-governance.md).
- Updated [docs/current-architecture.md](../current-architecture.md).
- Updated [database/postgresql/PARTITIONING_POLICY.md](../../database/postgresql/PARTITIONING_POLICY.md).
- Updated migration runbooks:
  - [database/postgresql/migrations/README_zero_downtime_snake_case.md](../../database/postgresql/migrations/README_zero_downtime_snake_case.md)
  - [database/postgresql/migrations/README_rename_columns_to_snake_case.md](../../database/postgresql/migrations/README_rename_columns_to_snake_case.md)
- Updated migration comments only (no SQL logic changes):
  - [database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.up.sql](../../database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.up.sql)
  - [database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.down.sql](../../database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.down.sql)
  - [database/postgresql/migrations/20260326_173200_zdt_contract_finalize_snake_cutover.up.sql](../../database/postgresql/migrations/20260326_173200_zdt_contract_finalize_snake_cutover.up.sql)

Risk reduction:
- Prevents operational confusion during DB migrations.
- Ensures runbooks and architecture docs reflect actual production workflow.

## 3) Duplicate entry points and duplicate route exposure
Problem:
- Frontend had a redundant app re-export entry file.
- Backend legacy aliases were duplicated in API schema surface.

Change:
- Removed dead frontend re-export file [frontend/src/app/App.tsx](../../frontend/src/app/App.tsx).
- Kept legacy backend routes for runtime compatibility but hid them from OpenAPI in [backend/app/api/v1/registration.py](../../backend/app/api/v1/registration.py) using `include_in_schema=False`.

Risk reduction:
- Reduces architectural drift and duplicate API documentation noise.
- Preserves backward compatibility for existing clients.

## 4) Repository hygiene
Problem:
- Local env/e2e artifacts could pollute working tree and commits.

Change:
- Extended [/.gitignore](../../.gitignore) for direnv and explicit frontend e2e outputs.

Risk reduction:
- Cleaner diffs and lower risk of committing local-only artifacts.

## 5) Validation summary
- Working tree is clean after push.
- Cleanup was delivered without intentional business-logic rewrites.
- OpenAPI generated-file noise was excluded from final scope.
