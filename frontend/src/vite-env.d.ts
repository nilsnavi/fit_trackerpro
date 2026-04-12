/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    /**
     * Optional signed Telegram WebApp `initData` for automatic dev login when the
     * app runs outside Telegram (`npm run dev`).
     */
    readonly VITE_DEV_INIT_DATA?: string
    readonly VITE_API_URL: string
    readonly VITE_TELEGRAM_BOT_USERNAME: string
    readonly VITE_ADMIN_USER_IDS?: string
    readonly VITE_TELEGRAM_WEBAPP_URL?: string
    readonly VITE_ENVIRONMENT?: string
    readonly VITE_SENTRY_DSN?: string
    readonly VITE_SENTRY_RELEASE?: string
    /** Абсолютный URL для sendBeacon/fetch (JSON `{ event, payload }`), без токена. */
    readonly VITE_WORKOUT_SYNC_TELEMETRY_URL?: string
    /** Если `1`, дублировать события в `POST {API_URL}/client/workout-sync-events` (нужен бэкенд). */
    readonly VITE_WORKOUT_SYNC_TELEMETRY_API?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
