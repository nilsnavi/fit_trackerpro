/**
 * MVP golden path: Telegram mock → auth → тренировка → упражнение → завершение → аналитика.
 * API частично мокается через Playwright route; стек Docker в CI поднимает /system/ready.
 */
import { test, expect } from '@playwright/test'
import {
    buildExercise,
    buildWorkoutState,
    mockWorkoutApi,
} from './helpers/workout-api-mock'

const WORKOUT_TITLE = 'MVP Golden Path E2E'

function buildAnalyticsWorkoutsPayload() {
    const today = new Date().toISOString().slice(0, 10)
    return {
        period: 'week',
        total_workouts: 1,
        total_duration_minutes: 45,
        avg_duration: 45,
        workouts_this_week: 1,
        workouts_this_month: 1,
        streak_days: 1,
        weekly_chart: [{ date: today, count: 1 }],
        intensity_weekly_chart: [] as { date: string; intensity_score: number | null }[],
        favorite_exercise: WORKOUT_TITLE,
        workouts_with_rpe_count: 0,
        avg_rpe_per_workout: null,
        avg_rpe_previous_period: null,
        avg_rpe_trend: null,
        avg_rest_time_seconds: null,
        intensity_score: null,
        total_time_under_tension_seconds: null,
    }
}

test.describe('MVP golden path (Telegram + route mocks)', () => {
    test.describe.configure({ timeout: 90_000 })

    test('auth → workout → exercise → complete → analytics', async ({ page }) => {
        await page.setViewportSize({ width: 412, height: 1200 })

        const state = buildWorkoutState({
            exercises: [buildExercise(9001, 'E2E Mock Exercise', 'strength')],
        })

        // index.html подключает telegram-web-app.js — он сбрасывает initData в браузере; для E2E отдаём пустышку.
        await page.route('**/telegram-web-app.js', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/javascript; charset=utf-8',
                body: '/* playwright: skip official Telegram script */',
            }),
        )

        await page.addInitScript(() => {
            const w = window as Window & {
                Telegram?: { WebApp?: Record<string, unknown> }
                __APP_CONFIG__?: Record<string, unknown>
            }
            w.Telegram = {
                WebApp: {
                    initData: 'mock',
                    initDataUnsafe: { user: { id: 12345, first_name: 'Test' } },
                    ready: () => {},
                    expand: () => {},
                    close: () => {},
                    onEvent: () => {},
                    offEvent: () => {},
                    setHeaderColor: () => {},
                    setBackgroundColor: () => {},
                    enableClosingConfirmation: () => {},
                    colorScheme: 'light',
                    themeParams: {},
                },
            }
            w.__APP_CONFIG__ = { API_URL: '/api/v1' }
        })

        await mockWorkoutApi(page, state)

        await page.route('**/api/v1/analytics/workouts**', async (route) => {
            if (route.request().method() !== 'GET') {
                return route.continue()
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify(buildAnalyticsWorkoutsPayload()),
            })
        })

        await page.route('**/api/v1/users/auth/lookup', async (route) => {
            if (route.request().method() !== 'POST') {
                return route.continue()
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify({ registered: true }),
            })
        })

        await page.route('**/api/v1/users/auth/telegram', async (route) => {
            if (route.request().method() !== 'POST') {
                return route.continue()
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify({
                    access_token: 'test-token',
                    is_new_user: false,
                    onboarding_required: false,
                    user: { id: 1 },
                }),
            })
        })

        await page.goto('/')
        await expect(page).toHaveURL(/\/$/)

        const nav = page.getByRole('navigation', { name: 'Основная навигация' })
        await expect(nav).toBeVisible()

        await page.goto('/workouts/mode/strength')
        await expect(page).toHaveURL(/\/workouts\/mode\/\w+/)

        await page.getByLabel('Название тренировки').fill(WORKOUT_TITLE)

        await page.locator('[data-testid="add-exercise-btn"]').click()
        const dialog = page.locator('[role="dialog"]').last()
        await expect(dialog).toBeVisible({ timeout: 10_000 })

        await dialog.getByPlaceholder(/Поиск упражнения|Search/i).fill('E2E Mock')
        await dialog.getByRole('button', { name: /E2E Mock Exercise/i }).first().click()

        const configDialog = page.locator('[role="dialog"]').last()
        await expect(configDialog).toBeVisible({ timeout: 10_000 })
        await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()
        await expect(configDialog).toBeHidden({ timeout: 10_000 })

        await expect(page.locator('#workout-mode-exercises').getByText('E2E Mock Exercise')).toBeVisible()

        await page.locator('[data-testid="save-and-start-btn"]').click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 30_000 })

        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })
        const setToggleButton = page.locator('[data-testid="set-toggle-btn"]').first()
        await setToggleButton.click()
        await expect(setToggleButton).toContainText(/Готово/)

        const finishBtn = page.locator('[data-testid="finish-workout-btn"]')
        await expect(finishBtn).toBeVisible({ timeout: 10_000 })
        await finishBtn.evaluate((el) => (el as HTMLButtonElement).click())

        const confirmFinishBtn = page.locator('[data-testid="confirm-finish-btn"]')
        await expect(confirmFinishBtn).toBeVisible({ timeout: 10_000 })
        await confirmFinishBtn.evaluate((el) => (el as HTMLButtonElement).click())
        await expect(page).not.toHaveURL(/\/workouts\/active\//, { timeout: 30_000 })

        await nav.getByRole('link', { name: 'Прогресс' }).click()
        await expect(page).toHaveURL(/\/analytics/)

        await expect(page.getByRole('heading', { name: 'Аналитика' })).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText('1 тренировка')).toBeVisible()
        await expect(page.getByText(WORKOUT_TITLE)).toBeVisible()
    })
})
