import type { Page } from '@playwright/test'
import type { WebApp } from '@shared/types/telegram'

type PasswordLoginOptions = {
    email: string
    password: string
    /** Button name, if differs across locales */
    submitLabel?: string
}

type TelegramLoginOptions = {
    /**
     * Telegram initData string. In real Mini App this is provided by Telegram.
     * In e2e we can inject it to window.Telegram.WebApp.initData before clicking the auth button.
     */
    initData: string
    /** Button label, if differs across builds */
    submitLabel?: string
    /** Auth endpoint the UI calls */
    endpoint?: string
}

export type EnsureAuthOptions = {
    /**
     * Fast path: directly set a known token (useful for local dev / pre-seeded environments).
     * If provided, no UI login will be attempted.
     */
    token?: string
    password?: PasswordLoginOptions
    telegram?: TelegramLoginOptions
}

function env(name: string): string | undefined {
    const v = process.env[name]
    return v && v.trim() !== '' ? v.trim() : undefined
}

export function ensureLoggedInOptionsFromEnv(): EnsureAuthOptions {
    const token = env('E2E_AUTH_TOKEN')

    const email = env('E2E_EMAIL')
    const password = env('E2E_PASSWORD')

    const tgInitData = env('E2E_TELEGRAM_INIT_DATA')

    return {
        token,
        password: email && password ? { email, password } : undefined,
        telegram: tgInitData ? { initData: tgInitData } : undefined,
    }
}

async function tryPasswordLogin(page: Page, opts: PasswordLoginOptions): Promise<boolean> {
    // Heuristic selectors: we’ll tighten to data-testid once real auth UI lands.
    const email = page.getByRole('textbox', { name: /email|e-mail|почта/i })
    const pass = page.getByRole('textbox', { name: /password|пароль/i })

    if (await email.count() === 0 || await pass.count() === 0) return false

    await email.first().fill(opts.email)
    await pass.first().fill(opts.password)

    const submit = page.getByRole('button', { name: new RegExp(opts.submitLabel ?? 'войти|sign in|login', 'i') })
    if (await submit.count() === 0) return false

    await submit.first().click()
    return true
}

async function tryTelegramLogin(page: Page, opts: TelegramLoginOptions): Promise<boolean> {
    const label = opts.submitLabel ?? 'войти через telegram|telegram|authenticate'
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') })
    if (await btn.count() === 0) return false

    await page.addInitScript((initData: string) => {
        // Minimal stub for common Telegram WebApp usage patterns.
        const w = window as Window & { Telegram?: { WebApp?: Partial<WebApp> } }
        w.Telegram = w.Telegram ?? {}
        w.Telegram.WebApp = w.Telegram.WebApp ?? {}
        w.Telegram.WebApp.initData = initData
        w.Telegram.WebApp.initDataUnsafe = { query_id: 'e2e' }
    }, opts.initData)

    const endpoint = opts.endpoint ?? '/api/v1/users/auth/telegram'
    const wait = page.waitForResponse((r) => r.url().includes(endpoint) && r.request().method() === 'POST')

    await btn.first().click()
    await wait
    return true
}

/**
 * Best-effort auth for e2e:
 * - If token is provided -> inject token
 * - Else tries UI-based login (password, then Telegram), if elements exist
 * - Else does nothing (caller decides what to assert)
 */
export async function ensureLoggedIn(page: Page, options: EnsureAuthOptions): Promise<void> {
    if (options.token) {
        await page.addInitScript((token: string) => {
            localStorage.setItem('auth_token', token)
        }, options.token)
        return
    }

    await page.goto('/login')

    if (options.password) {
        const ok = await tryPasswordLogin(page, options.password)
        if (ok) return
    }

    if (options.telegram) {
        const ok = await tryTelegramLogin(page, options.telegram)
        if (ok) return
    }
}

