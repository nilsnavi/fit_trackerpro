/**
 * Runtime config from `public/config.js` (Docker: generated via envsubst from `config.template.js`).
 * In local dev, `public/config.js` may leave values empty so Vite `import.meta.env` applies.
 */

export interface AppRuntimeConfig {
    /** Base URL for REST API, e.g. https://example.com/api/v1 */
    API_URL: string
    /** Bot username without @ */
    TELEGRAM_BOT_USERNAME: string
    /** Public Mini App URL (share / deep links) */
    TELEGRAM_WEBAPP_URL: string
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

export function getRuntimeConfig(): AppRuntimeConfig {
    const w = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined

    return {
        API_URL:
            firstNonEmpty(w?.API_URL, import.meta.env.VITE_API_URL) ?? DEFAULT_API_URL,
        TELEGRAM_BOT_USERNAME:
            firstNonEmpty(w?.TELEGRAM_BOT_USERNAME, import.meta.env.VITE_TELEGRAM_BOT_USERNAME) ??
            '',
        TELEGRAM_WEBAPP_URL:
            firstNonEmpty(w?.TELEGRAM_WEBAPP_URL, import.meta.env.VITE_TELEGRAM_WEBAPP_URL) ??
            '',
    }
}

export function getPublicApiBaseUrl(): string {
    return getRuntimeConfig().API_URL
}

export function getTelegramBotUsername(): string {
    return getRuntimeConfig().TELEGRAM_BOT_USERNAME
}

export function getTelegramWebAppUrl(): string {
    return getRuntimeConfig().TELEGRAM_WEBAPP_URL
}
