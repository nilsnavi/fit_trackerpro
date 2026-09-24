# Backend reference data

This directory is bundled into the backend Docker image (backend build context is `./backend`).

`backend/reference_data/` is the source of truth consumed by
`app.cli.seed_reference_data`. The matching files under `../database/reference_data/`
are kept as a checked-in mirror for database tooling; regenerate the backend files
first and copy the catalog/reference tables to the mirror when refreshing them.

