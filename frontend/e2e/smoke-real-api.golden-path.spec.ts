import { expect, test } from '@playwright/test'

type AuthResponse = {
    access_token: string
}

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const telegramInitData = process.env.E2E_TELEGRAM_INIT_DATA

test.describe('Smoke real API golden path @smoke-real @nightly', () => {
    test.describe.configure({ timeout: 120_000 })

    test('auth -> template -> start -> complete -> analytics', async ({ page, request }) => {
        test.skip(!telegramInitData, 'E2E_TELEGRAM_INIT_DATA is required for real-API smoke run')

        const authRes = await request.post(`${apiBaseUrl}/users/auth/telegram`, {
            data: { init_data: telegramInitData },
        })
        expect(authRes.ok()).toBeTruthy()
        const authJson = (await authRes.json()) as AuthResponse
        expect(authJson.access_token).toBeTruthy()

        const authed = await request.newContext({
            extraHTTPHeaders: {
                Authorization: `Bearer ${authJson.access_token}`,
            },
        })

        const title = `Smoke Template ${Date.now()}`
        const templateRes = await authed.post(`${apiBaseUrl}/workouts/templates`, {
            data: {
                name: title,
                type: 'strength',
                exercises: [
                    {
                        exercise_id: 1,
                        name: 'Push-ups',
                        sets: 3,
                        reps: 10,
                        rest_seconds: 60,
                    },
                ],
                is_public: false,
            },
        })
        expect(templateRes.ok()).toBeTruthy()
        const templateJson = (await templateRes.json()) as { id: number }
        expect(templateJson.id).toBeGreaterThan(0)

        const startRes = await authed.post(`${apiBaseUrl}/workouts/start`, {
            data: { template_id: templateJson.id },
        })
        expect(startRes.ok()).toBeTruthy()
        const startJson = (await startRes.json()) as { id: number }
        expect(startJson.id).toBeGreaterThan(0)

        const completeRes = await authed.post(`${apiBaseUrl}/workouts/complete`, {
            params: { workout_id: String(startJson.id) },
            data: {
                duration: 25,
                exercises: [
                    {
                        exercise_id: 1,
                        name: 'Push-ups',
                        sets_completed: [
                            { set_number: 1, completed: true, reps: 10 },
                            { set_number: 2, completed: true, reps: 10 },
                        ],
                    },
                ],
                tags: ['strength'],
            },
        })
        expect(completeRes.ok()).toBeTruthy()

        const summaryRes = await authed.get(`${apiBaseUrl}/analytics/summary`, {
            params: { period: '30d' },
        })
        expect(summaryRes.ok()).toBeTruthy()
        const summaryJson = (await summaryRes.json()) as { total_workouts?: number }
        expect((summaryJson.total_workouts ?? 0) >= 1).toBeTruthy()

        await page.addInitScript((token: string) => {
            localStorage.setItem('auth_token', token)
        }, authJson.access_token)

        await page.goto('/progress')
        await expect(page.getByRole('heading', { name: /Прогресс|Progress/i })).toBeVisible()

        await authed.dispose()
    })
})
