import { test, expect, devices } from '@playwright/test'
import {
    type WorkoutHistoryItem,
    type WorkoutTemplate,
    buildWorkoutState,
    seedAuth,
    seedDraft,
    mockWorkoutApi,
    isoNow,
    isoMinutesAgo,
} from './helpers/workout-api-mock'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test.use({ ...devices['Pixel 7'] })

test.describe('mobile workout regressions @regression @mobile', () => {
    test.describe.configure({ timeout: 60_000 })

    test.beforeEach(async ({ page }) => {
        // Mobile suite runs under a Playwright "project" now; ensure Telegram WebApp exists
        // to avoid being stuck on the "Open Mini App in Telegram" fallback screen.
        await setupTelegramWebApp(page, {
            platform: 'android',
            safeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
            contentSafeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
        })
    })

    test('resume active workout from hub', async ({ page }) => {
        const draftWorkoutId = 1701
        const draftWorkout: WorkoutHistoryItem = {
            id: draftWorkoutId,
            date: isoNow(),
            duration: undefined,
            exercises: [
                {
                    exercise_id: 1002,
                    name: 'Жим лёжа',
                    sets_completed: [
                        { set_number: 1, reps: 8, weight: 70, completed: false },
                        { set_number: 2, reps: 8, weight: 70, completed: false },
                    ],
                },
            ],
            comments: 'E2E mobile draft resume',
            tags: ['strength'],
            created_at: isoMinutesAgo(12),
        }

        const state = buildWorkoutState({
            historyItems: [draftWorkout],
            details: new Map([[draftWorkoutId, draftWorkout]]),
        })

        await seedAuth(page)
        await seedDraft(page, draftWorkoutId, 'E2E mobile draft resume')
        await mockWorkoutApi(page, state)

        await page.goto('/workouts')
        await expect(page.locator('[data-testid="resume-draft-btn"]')).toBeVisible({ timeout: 30_000 })

        await page.locator('[data-testid="resume-draft-btn"]').click()

        await expect(page).toHaveURL(new RegExp(`/workouts/active/${draftWorkoutId}(?:\\?.*)?$`))
        await expect(page.getByText('Прогресс сессии').first()).toBeVisible()
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible()
    })

    test('start workout from template on mobile', async ({ page }) => {
        const template: WorkoutTemplate = {
            id: 2201,
            user_id: 1,
            name: 'E2E Mobile Template',
            type: 'strength',
            exercises: [
                {
                    exercise_id: 1001,
                    name: 'Присед',
                    sets: 3,
                    reps: 6,
                    weight: 85,
                },
            ],
            is_public: false,
            created_at: isoMinutesAgo(120),
            updated_at: isoMinutesAgo(60),
        }

        const state = buildWorkoutState({
            templates: [template],
        })

        await seedAuth(page)
        await mockWorkoutApi(page, state)

        await page.goto('/workouts/templates')
        await expect(page.getByRole('heading', { name: 'E2E Mobile Template' })).toBeVisible({ timeout: 30_000 })

        const card = page.locator('div.rounded-2xl', { hasText: 'E2E Mobile Template' }).first()
        await card.getByRole('button', { name: 'Начать по шаблону' }).click()

        await expect.poll(() => state.startRequests.length).toBe(1)
        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })
    })

    test('compact set logging and rest timer interaction', async ({ page }) => {
        const workoutId = 2602
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
            date: isoNow(),
            duration: undefined,
            exercises: [
                {
                    exercise_id: 1001,
                    name: 'Присед',
                    sets_completed: [
                        { set_number: 1, reps: 5, weight: 80, completed: false },
                        { set_number: 2, reps: 5, weight: 80, completed: false },
                    ],
                },
                {
                    exercise_id: 1002,
                    name: 'Жим лёжа',
                    sets_completed: [
                        { set_number: 1, reps: 8, weight: 65, completed: false },
                    ],
                },
            ],
            comments: 'E2E compact logging',
            tags: ['strength'],
            created_at: isoMinutesAgo(18),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E compact logging')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await expect(page.locator('[data-testid="set-row"]').first()).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

        await expect(page.getByRole('button', { name: 'Показать' }).first()).toBeVisible()
        await page.getByRole('button', { name: /Отдых\s/ }).first().click()

        await expect(page.getByText('Отдых').first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Пропустить' }).last()).toBeVisible()

        await page.locator('[data-testid="set-toggle-btn"]').first().click()
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 10_000 }).toBeGreaterThan(0)
    })
})
