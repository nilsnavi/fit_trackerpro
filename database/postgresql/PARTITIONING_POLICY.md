# FitTracker Pro Partitioning Policy

## Decision

Do **not** enable table partitioning on day one (MVP).

## MVP stage

- Use regular tables.
- Invest in correct indexes and query plans first.
- Keep migrations and Prisma workflow simple.
- Optimize for rapid product iteration and operational simplicity.

## Why partitioning is deferred

- Adds complexity to schema migrations.
- Increases complexity in Prisma-based development workflows.
- Complicates backup and restore procedures.
- Can slow down development velocity without clear performance benefit at MVP scale.

## Growth-stage trigger

Introduce partitioning only after observing sustained production pressure, for example:

- Large table sizes and retention windows cause degraded query latency.
- Index maintenance cost and vacuum pressure become significant.
- Write-heavy workloads on event tables create hotspots.

## Candidate tables for future partitioning

- `workout_sets`
- `sync_events`
- `ai_coach_messages`

## Rollout principle

1. Measure first (table sizes, query latency, bloat, autovacuum behavior).
2. Partition one table at a time.
3. Validate query plans and operational runbooks.
4. Expand gradually only when metrics justify it.
