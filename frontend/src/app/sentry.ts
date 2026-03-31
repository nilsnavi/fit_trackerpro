import * as Sentry from '@sentry/react'

import packageJson from '../../package.json'
import { getPublicApiBaseUrl, getRuntimeConfig } from '@shared/config/runtime'

export function isSentryEnabled(): boolean {
    return Boolean(getRuntimeConfig().SENTRY_DSN?.trim())
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
    const cfg = getRuntimeConfig()
    const dsn = cfg.SENTRY_DSN?.trim()
    if (!dsn) {
        return
    }

    const environment = (cfg.SENTRY_ENVIRONMENT || 'development').trim()
    const release = cfg.SENTRY_RELEASE?.trim() || `fittracker-web@${packageJson.version}`
    const dist = cfg.SENTRY_DIST?.trim()

    const isProd = environment === 'production'

    Sentry.init({
        dsn,
        environment,
        release,
        dist: dist || undefined,
        integrations: [Sentry.browserTracingIntegration()],
        tracePropagationTargets: tracePropagationTargets(),
        tracesSampleRate: isProd ? 0.1 : 1.0,
        sendDefaultPii: false,
        maxBreadcrumbs: 50,
        initialScope: {
            tags: {
                service: 'fittracker-frontend',
                component: 'frontend',
                app: 'fittracker',
            },
        },
        ignoreErrors: [
            // Common noisy browser errors
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.',
            'Non-Error promise rejection captured',
        ],
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
