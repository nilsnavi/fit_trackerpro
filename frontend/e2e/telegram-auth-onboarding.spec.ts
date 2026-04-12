import { expect, test } from '@playwright/test'

test.describe('telegram auth bootstrap and onboarding @regression', () => {
    test('shows fallback screen when Telegram context is missing', async ({ page }) => {
        await page.goto('/')

        await expect(page.getByRole('heading', { name: 'Откройте приложение в Telegram' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Проверить снова' })).toBeVisible()
    })

    test('completes onboarding for authenticated first login', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('auth_token', 'bootstrap-auth-token')
        })

        let profileCalls = 0
        let onboardingBody: Record<string, unknown> | null = null

        await page.route('**/*', async (route) => {
            const request = route.request()
            const requestUrl = request.url()
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

            if (method === 'GET' && path.includes('/users/auth/me')) {
                profileCalls += 1
                return json(200, {
                    id: 1,
                    telegram_id: 777,
                    username: 'e2e_user',
                    first_name: 'E2E',
                    profile: {
                        onboarding_completed: false,
                    },
                    settings: {
                        theme: 'telegram',
                        notifications: true,
                        units: 'metric',
                    },
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-01T00:00:00Z',
                })
            }

            if (method === 'POST' && path.includes('/users/auth/onboarding')) {
                onboardingBody = request.postDataJSON() as Record<string, unknown>
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
