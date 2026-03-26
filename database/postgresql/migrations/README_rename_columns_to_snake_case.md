# Rename Columns to Snake Case (Runbook)

## Files

- `20260326_170900_rename_columns_to_snake_case.up.sql`
- `20260326_170900_rename_columns_to_snake_case.down.sql`

## What this migration does

- Renames DB columns from camelCase to snake_case to match Prisma `@map("snake_case")`.
- Uses `information_schema.columns` guards, so it is idempotent and safe to re-run.
- Performs only `ALTER TABLE ... RENAME COLUMN ...` operations (no data rewrite).

## Pre-checks (recommended)

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'workout_sessions', 'sync_events',
    'adaptive_recommendations', 'social_workout_posts', 'friendships'
  )
ORDER BY table_name, column_name;
```

## Apply

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.up.sql
```

## Verify key tables

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sync_events'
ORDER BY column_name;
```

Expected examples:
- `user_id`
- `event_status`
- `occurred_at`
- `created_at`

## Rollback

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgresql/migrations/20260326_170900_rename_columns_to_snake_case.down.sql
```

## Operational note

- During deploy, run migration before shipping app version that expects snake_case physical columns via Prisma `@map`.
