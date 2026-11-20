# V2-03C.4A — Athlete consent dashboard

Status: draft frontend-only implementation. Uses merged V2-03C.2 API in main.

- Premium Athlete privacy screen `/athlete/consents` with server-backed own grant list.
- Explicit 2-step revoke with backend DELETE; no optimistic permission changes; invalidate query on confirmed success.
- Regrant only for an already visible previously revoked/expired grant and exact coach/scope. Independent explicit confirmation and fixed consent version; no automatic regrant.
- Never expose health, notes, workout data, or infer coach identity from arbitrary ids. Coach ID is shown until a safe display-name API exists; do not fabricate names.
- No new grant to an unrelated coach: need client-owned ACTIVE relationship selector API, scheduled V2-03C.4B. No manual ID input.
- Only current authenticated user's Bearer token, identity-scoped React Query key; no token in query key or persistent storage.
- Need QA on errors, logout, account switch, paused link, blocked retries and multi-user E2E before merge.
- This frontend screen does not prove all existing Coach read routes are consent-protected. Backend C.3 PRs remain dependent and unmerged.
