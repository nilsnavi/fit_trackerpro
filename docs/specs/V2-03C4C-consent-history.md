# V2-03C.4C — Athlete consent history

Status: Draft. Owner-scoped read-only history on existing transactional audit table.

- GET /api/v1/client/coach-grants/{grant_id}/history requires authenticated client.
- Server verifies exact ownership from coach_client_grants before returning events.
- Responses include only grant_id and event id, coach_id, scope, action GRANTED/REVOKED, consent_version and occurred_at. No client secrets or health values.
- Historical regrant on the same grant_id remains visible. Events sorted latest first with stable tie-break.
- Wrong owner, nonexistent and malformed grant IDs return 404; no enumeration.
- Athlete PWA shows issuance, expiry, revoke date and expands the server audit history on demand.
- Per-account identity-scoped query key and no-store transport; no optimistic audit entries.
- No schema migration: uses existing coach_grant_audit.
- Security caveat: audit records are appended by application code but DB-level immutable enforcement is a separate security task.
- QA: backend integration ownership, frontend DTO projection, OpenAPI synchronization, responsive/mobile E2E, migration regression, full security CI.
