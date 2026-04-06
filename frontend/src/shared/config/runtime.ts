/**
 * Runtime config from `public/config.js` (Docker: `startup.sh` writes `config.js` from `config.template.js` before nginx).
 * In local dev, `public/config.js` may leave values empty so Vite `import.meta.env` applies.
 */

export interface AppRuntimeConfig {
    /** Base URL for REST API, e.g. https://example.com/api/v1 */
    API_URL: string
    /** Comma-separated Telegram IDs that are allowed to use admin UI actions */
    ADMIN_USER_IDS: string
    /** Bot username without @ */
    TELEGRAM_BOT_USERNAME: string
    /** Public Mini App URL (share / deep links) */
    TELEGRAM_WEBAPP_URL: string
    /** Sentry DSN for browser SDK (optional) */
    SENTRY_DSN: string
    /** Sentry environment, e.g. production/staging/dev (optional) */
    SENTRY_ENVIRONMENT: string
    /** Sentry release, e.g. fittracker-web@<sha> (optional) */
    SENTRY_RELEASE: string
    /** Sentry dist (optional, useful for SPA build artifacts) */
    SENTRY_DIST: string
    /** Feature flag: use real analytics backend API instead of local mocks */
    USE_REAL_ANALYTICS: boolean
}

declare global {
    interface Window {
        __APP_CONFIG__?: Partial<AppRuntimeConfig>
    }
}

const DEFAULT_API_URL = 'http://localhost:8000/api/v1'

function trim(s: string | undefined): string | undefined {
    const t = s?.trim()
    return t === '' ? undefined : t
}

/** First defined non-empty string wins. */
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
    for (const v of values) {
        const t = trim(v)
        if (t !== undefined) return t
    }
    return undefined
}

function parseBoolean(v: unknown): boolean | undefined {
    if (typeof v === 'boolean') return v
    if (typeof v !== 'string') return undefined
    const t = trim(v)?.toLowerCase()
    if (t === undefined) return undefined
    if (t === 'true' || t === '1' || t === 'yes' || t === 'y' || t === 'on') return true
    if (t === 'false' || t === '0' || t === 'no' || t === 'n' || t === 'off') return false
    return undefined
}

export function getRuntimeConfig(): AppRuntimeConfig {
    const w = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined

    return {
        API_URL:
            firstNonEmpty(w?.API_URL, import.meta.env.VITE_API_URL) ?? DEFAULT_API_URL,
        ADMIN_USER_IDS:
            firstNonEmpty(w?.ADMIN_USER_IDS, import.meta.env.VITE_ADMIN_USER_IDS) ?? '',
        TELEGRAM_BOT_USERNAME:
            firstNonEmpty(w?.TELEGRAM_BOT_USERNAME, import.meta.env.VITE_TELEGRAM_BOT_USERNAME) ??
            '',
        TELEGRAM_WEBAPP_URL:
            firstNonEmpty(w?.TELEGRAM_WEBAPP_URL, import.meta.env.VITE_TELEGRAM_WEBAPP_URL) ??
            '',
        SENTRY_DSN: firstNonEmpty(w?.SENTRY_DSN, import.meta.env.VITE_SENTRY_DSN) ?? '',
        SENTRY_ENVIRONMENT:
            firstNonEmpty(w?.SENTRY_ENVIRONMENT, import.meta.env.VITE_ENVIRONMENT, import.meta.env.MODE) ??
            'development',
        SENTRY_RELEASE: firstNonEmpty(w?.SENTRY_RELEASE, import.meta.env.VITE_SENTRY_RELEASE) ?? '',
        SENTRY_DIST: firstNonEmpty(w?.SENTRY_DIST) ?? '',
        USE_REAL_ANALYTICS:
            parseBoolean(w?.USE_REAL_ANALYTICS ?? import.meta.env.VITE_USE_REAL_ANALYTICS) ?? false,
    }
}

export function getPublicApiBaseUrl(): string {
    return getRuntimeConfig().API_URL
}

export function useRealAnalytics(): boolean {
    return getRuntimeConfig().USE_REAL_ANALYTICS
}

export function getTelegramBotUsername(): string {
    return getRuntimeConfig().TELEGRAM_BOT_USERNAME
}

export function getTelegramWebAppUrl(): string {
    return getRuntimeConfig().TELEGRAM_WEBAPP_URL
}

export function getAdminUserIdsRaw(): string {
    return getRuntimeConfig().ADMIN_USER_IDS
}
