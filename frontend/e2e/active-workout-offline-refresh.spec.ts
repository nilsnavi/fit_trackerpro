import { expect, test } from '@playwright/test'
import {
    type WorkoutHistoryItem,
    buildWorkoutState,
    isoMinutesAgo,
    isoNow,
    mockWorkoutApi,
    seedAuth,
    seedDraft,
} from './helpers/workout-api-mock'

const APP_BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

test.describe('active workout offline/refresh flows @regression', () => {
    test('refresh keeps active workout progress', async ({ page }) => {
        const workoutId = 4101
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
            ],
            comments: 'E2E refresh flow',
            tags: ['strength'],
            created_at: isoMinutesAgo(15),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E refresh flow')
        await mockWorkoutApi(page, state)

        await page.goto(`${APP_BASE_URL}/workouts/active/${workoutId}`)
        await expect(page.getByTestId('active-workout-session-bar')).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

        await page.locator('[data-testid="set-toggle-btn"]').first().click()
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)

        await page.reload()

        await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}(?:\\?.*)?$`))
        await expect(page.getByTestId('active-workout-session-bar')).toBeVisible()
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toContainText('✓ Готово')
    })

    test('offline changes are recovered and synced after reconnect', async ({ page, context }) => {
        const workoutId = 4102
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
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
            comments: 'E2E offline recovery flow',
            tags: ['strength'],
            created_at: isoMinutesAgo(10),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E offline recovery flow')
        await mockWorkoutApi(page, state)

        await page.goto(`${APP_BASE_URL}/workouts/active/${workoutId}`)
        await expect(page.getByTestId('active-workout-session-bar')).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

        await context.setOffline(true)
        await expect(page.getByTestId('active-workout-session-bar')).toBeVisible()
        // После offline React может перерисовать список — обычный click ловит «detached».
        await page.locator('[data-testid="set-toggle-btn"]').first().evaluate((el) => (el as HTMLElement).click())

        await expect(page.getByTestId('workout-sync-indicator')).toContainText(/Офлайн|очереди/i, { timeout: 12_000 })
        await expect.poll(() => state.updateSessionRequests.length).toBe(0)

        await context.setOffline(false)
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)

        await expect(page.getByTestId('workout-sync-indicator')).toContainText('Сохранено', { timeout: 12_000 })
    })
})
