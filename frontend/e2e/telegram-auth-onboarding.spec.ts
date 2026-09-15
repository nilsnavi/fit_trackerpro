import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test.describe('telegram auth bootstrap and onboarding @regression', () => {
    test('shows fallback screen when Telegram context is missing', async ({ page }) => {
        // index.html loads telegram-web-app.js from telegram.org; serve it empty so the
        // missing-context state is the same in every target instead of depending on
        // whether that host is reachable.
        await page.route('**/telegram-web-app.js', (route) =>
            route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
        )
        await page.goto('/')

        await expect(page.getByRole('heading', { name: 'Открой в Telegram' })).toBeVisible()
        await expect(
            page.getByText(/Мини-приложение доступно через бота|Запустите мини-приложение из Telegram/),
        ).toBeVisible()
    })

    test('completes onboarding for authenticated first login', async ({ page }) => {
        await setupTelegramWebApp(page)
        await page.addInitScript(() => {
            localStorage.setItem('auth_token', 'bootstrap-auth-token')
        })

        let profileCalls = 0
        let onboardingBody: Record<string, unknown> | null = null
        // The app re-reads the profile after saving and keeps the onboarding screen up
        // until the server reports the flag as done.
        let onboardingCompleted = false

        await page.route('**/*', async (route) => {
            const request = route.request()
            const requestUrl = request.url()

            // HealthCheckGate unmounts the app behind a maintenance screen without this.
            if (requestUrl.includes('/health/ready')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json; charset=utf-8',
                    headers: { 'access-control-allow-origin': '*' },
                    body: JSON.stringify({
                        status: 'ready',
                        timestamp: new Date().toISOString(),
                        dependencies: { database: { name: 'database', healthy: true } },
                    }),
                })
            }

            if (!requestUrl.includes('/api/v1/')) {
                return route.fallback()
            }

            const url = new URL(requestUrl)
            const path = url.pathname
            const method = request.method()

            const corsHeaders = {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'access-control-allow-headers': 'authorization,content-type',
            }

            const json = (status: number, body: unknown) =>
                route.fulfill({
                    status,
                    contentType: 'application/json; charset=utf-8',
                    headers: corsHeaders,
                    body: JSON.stringify(body),
                })

            if (method === 'OPTIONS') {
                return route.fulfill({ status: 204, headers: corsHeaders, body: '' })
            }

            // TelegramAuthGate exchanges the injected initData before the app renders.
            if (method === 'POST' && path.includes('/users/auth/telegram')) {
                return json(200, {
                    success: true,
                    message: 'ok',
                    access_token: 'bootstrap-auth-token',
                    refresh_token: null,
                    is_new_user: false,
                    onboarding_required: true,
                })
            }

            const profile = () => ({
                id: 1,
                telegram_id: 777,
                username: 'e2e_user',
                first_name: 'E2E',
                profile: {
                    onboarding_completed: onboardingCompleted,
                },
                settings: {
                    theme: 'telegram',
                    notifications: true,
                    units: 'metric',
                },
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
            })

            if (method === 'GET' && path.includes('/auth/me')) {
                profileCalls += 1
                return json(200, profile())
            }

            // The onboarding screen renames the user before saving the goals.
            if (method === 'PUT' && path.includes('/auth/me')) {
                return json(200, profile())
            }

            if (method === 'POST' && path.includes('/auth/onboarding')) {
                onboardingBody = request.postDataJSON() as Record<string, unknown>
                onboardingCompleted = true
                return json(200, {
                    success: true,
                    message: 'Onboarding saved',
                    profile: {
                        fitness_goal: onboardingBody.fitness_goal,
                        experience_level: onboardingBody.experience_level,
                        onboarding_completed: true,
                    },
                })
            }

            return json(500, { detail: `Unhandled e2e API route: ${method} ${path}` })
        })

        await page.goto('/')

        await expect(
            page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' }),
        ).toBeVisible()

        await page.getByLabel('Выносливость').check()
        await page.getByLabel('Продвинутый').check()
        await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()

        await expect(
            page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' }),
        ).toBeHidden()
        await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()

        expect(profileCalls).toBeGreaterThanOrEqual(1)
        expect(onboardingBody).toEqual({
            fitness_goal: 'endurance',
            experience_level: 'advanced',
        })
    })
})
