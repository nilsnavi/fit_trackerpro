import * as Sentry from '@sentry/react'

import packageJson from '../../package.json'
import { getPublicApiBaseUrl } from '@shared/config/runtime'

export function isSentryEnabled(): boolean {
    return Boolean(import.meta.env.VITE_SENTRY_DSN?.trim())
}

function tracePropagationTargets(): (string | RegExp)[] {
    const raw = getPublicApiBaseUrl()
    if (!raw) {
        return ['localhost']
    }
    try {
        const u = new URL(raw)
        return [`${u.protocol}//${u.host}`]
    } catch {
        return ['localhost']
    }
}

/**
 * Call once before React render. No-op when `VITE_SENTRY_DSN` is unset.
 */
export function initSentry(): void {
    const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
    if (!dsn) {
        return
    }

    const environment =
        import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development'
    const release =
        import.meta.env.VITE_SENTRY_RELEASE?.trim() ||
        `fittracker-web@${packageJson.version}`

    const isProd = environment === 'production'

    Sentry.init({
        dsn,
        environment,
        release,
        integrations: [Sentry.browserTracingIntegration()],
        tracePropagationTargets: tracePropagationTargets(),
        tracesSampleRate: isProd ? 0.1 : 1.0,
        sendDefaultPii: false,
        beforeSend(event) {
            if (event.request?.headers) {
                const h = event.request.headers as Record<string, string>
                for (const key of Object.keys(h)) {
                    if (key.toLowerCase() === 'authorization') {
                        h[key] = '[Redacted]'
                    }
                }
            }
            return event
        },
    })
}

/** Mini App / browser context (Telegram user id is the same id used in JWT `sub`). */
export function setSentryClientContext(options: {
    isTelegram: boolean
    telegramUserId?: number
}): void {
    if (!isSentryEnabled()) {
        return
    }
    Sentry.setTag('client', options.isTelegram ? 'telegram_mini_app' : 'browser')
    if (options.telegramUserId != null) {
        Sentry.setUser({ id: String(options.telegramUserId) })
    } else {
        Sentry.setUser(null)
    }
}
