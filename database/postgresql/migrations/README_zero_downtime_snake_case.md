# Zero-Downtime Snake Case Cutover

## Goal

Migrate physical DB columns from legacy camelCase usage to snake_case-compatible runtime
without breaking live traffic during deployment.

Related policy:
- Partitioning strategy is intentionally deferred for MVP: `../PARTITIONING_POLICY.md`

## Phase order

1. **Expand**
   - Apply: `20260326_173000_zdt_expand_add_snake_columns_and_sync.up.sql`
   - Adds snake_case columns (if missing), backfills from camelCase, and installs dual-write triggers.

2. **Deploy app**
   - Deploy backend using current Prisma schema (`@map("snake_case")`).
   - Keep all app pods on this version.

3. **Validate**
   - Apply: `20260326_173100_zdt_validate_no_drift.sql`
   - Fails if any camelCase/snake_case pair diverged.

4. **Finalize**
   - Apply: `20260326_173200_zdt_contract_finalize_snake_cutover.up.sql`
   - Removes dual-write triggers/functions.
   - Keeps legacy camelCase columns intentionally for safety.

5. **Optional hard cleanup**
   - Audit first: `20260326_174000_zdt_cleanup_audit_legacy_camel_columns.sql`
   - Cleanup: `20260326_174100_zdt_cleanup_drop_legacy_camel_columns_if_safe.up.sql`
   - Drops legacy camelCase columns only when safe checks pass.

## Commands

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_173000_zdt_expand_add_snake_columns_and_sync.up.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_173100_zdt_validate_no_drift.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_173200_zdt_contract_finalize_snake_cutover.up.sql

# optional hard cleanup
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_174000_zdt_cleanup_audit_legacy_camel_columns.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_174100_zdt_cleanup_drop_legacy_camel_columns_if_safe.up.sql
```

## Why no automatic drop of camelCase columns here

Dropping legacy columns in the same automated step can remove old constraints/indexes/FKs
that may still be needed in your environment. Do that only in a dedicated audited migration
after explicitly recreating all required constraints/indexes on snake_case columns.

## Cleanup behavior details

- `...174000...audit...sql` only reports actions (`drop_candidate`, `skip_has_dependencies`, etc.).
- `...174100...if_safe...sql` drops a legacy column only if:
  - both legacy and snake columns exist,
  - and the legacy column has no dependency rows in `pg_depend`.
- If checks fail, it emits `NOTICE` and skips that column instead of failing the whole migration.
