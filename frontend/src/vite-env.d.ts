/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_TELEGRAM_BOT_USERNAME: string
    readonly VITE_TELEGRAM_WEBAPP_URL?: string
    readonly VITE_ENVIRONMENT?: string
    readonly VITE_SENTRY_DSN?: string
    readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
