# V2-03C.1 — persistence and fail-closed authorization

Adds an **empty** coach_client_grants table after s11_2_email_auth, registered ORM model and read-only repository.

- No endpoint creates or exposes grants. Old coach_clients.permissions does not confer access.
- Only training_summary.read and workout_history.read are allowlisted; health_metrics.read is forbidden by DB constraint and service.
- All checks run against the DB: coach flag, explicit COACH role, active coach profile, exact active relationship, exact non-revoked grant, current consent version, non-expired access.
- No cross-request positive authorization caching.
- Uniqueness per relationship/scope prevents duplicate grants. The next stage must implement consented grant lifecycle, audit and safe regrant.
- No production deploy. Staging PostgreSQL migration up/down, concurrency and audit are required before any Coach reads are enabled.
- Caveat: transactional revoke-vs-read races must be handled by the eventual read endpoint and revoked-grant cache invalidation; this repository is a read-side prerequisite, not a complete consent system.
