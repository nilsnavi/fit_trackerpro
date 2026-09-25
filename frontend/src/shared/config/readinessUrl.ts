/**
 * URL of the backend readiness probe (`GET /health/ready`, served at the API root by
 * `app.main`, not under `/api/v1`).
 *
 * Derived from `API_URL`, so a backend on another origin or behind a path prefix is
 * checked there — not on the SPA's own origin (where the dev server / SPA fallback
 * would answer 404 or `index.html`).
 *
 * | API_URL                          | readiness URL                          |
 * |----------------------------------|----------------------------------------|
 * | `/api/v1` (same origin)          | `/health/ready`                        |
 * | `https://api.example.com/api/v1` | `https://api.example.com/health/ready` |
 * | `https://x.com/backend/api/v1`   | `https://x.com/backend/health/ready`   |
 *
 * Pure (no `import.meta`) so it can be unit-tested directly.
 */
export function resolveBackendReadinessUrl(apiBaseUrl: string, pageOrigin?: string): string {
    const fallback = '/health/ready'
    const origin = pageOrigin && pageOrigin !== 'null' ? pageOrigin : undefined
    try {
        const url = new URL(apiBaseUrl.trim(), origin ?? 'http://localhost')
        const prefix = url.pathname.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '')
        const path = `${prefix}/health/ready`
        const sameOrigin =
            origin !== undefined ? url.origin === origin : apiBaseUrl.trim().startsWith('/')
        return sameOrigin ? path : `${url.origin}${path}`
    } catch {
        return fallback
    }
}
