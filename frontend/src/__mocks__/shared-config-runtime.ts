/** Jest mock for @shared/config/runtime — replaces import.meta.env usage in tests. */
import type { AppRuntimeConfig } from '../shared/config/runtime'

export function getRuntimeConfig(): AppRuntimeConfig {
    return {
        API_URL: 'http://localhost:8000/api/v1',
        ADMIN_USER_IDS: '',
        TELEGRAM_BOT_USERNAME: 'test_bot',
        TELEGRAM_WEBAPP_URL: 'https://test.example.com',
        SENTRY_DSN: '',
        SENTRY_ENVIRONMENT: 'test',
        SENTRY_RELEASE: '',
        SENTRY_DIST: '',
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

export function getAdminUserIdsRaw(): string {
    return ''
}
