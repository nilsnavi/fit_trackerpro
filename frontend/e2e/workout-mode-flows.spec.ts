import { test, expect } from '@playwright/test'
import {
    type CompletedExercise,
    type WorkoutHistoryItem,
    buildWorkoutState,
    seedAuth,
    seedDraft,
    mockWorkoutApi,
    isoNow,
    isoMinutesAgo,
} from './helpers/workout-api-mock'

test.describe('workouts regression suite @regression @workout-flows', () => {
test.describe.configure({ timeout: 60_000 })

test('mode -> add exercise -> save', async ({ page }) => {
    const state = buildWorkoutState()
    await seedAuth(page)
    await mockWorkoutApi(page, state)

    await page.goto('/workouts/mode/strength')

    const title = 'E2E силовая • сохранить'
    await page.getByLabel('Название тренировки').fill(title)
    await page.locator('[data-testid="add-exercise-btn"]').click()

    const dialog = page.locator('[role="dialog"]').last()
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Поиск упражнения...').fill('Присед')
    await dialog.getByRole('button', { name: 'Присед' }).first().click()

    const configDialog = page.locator('[role="dialog"]').last()
    await expect(configDialog).toBeVisible()
    await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()

    await expect(page.locator('#workout-mode-exercises').getByText('Присед')).toBeVisible()
    await expect(configDialog).toBeHidden()
    await page.locator('[data-testid="save-btn"]').click()

    await expect.poll(() => state.createTemplateRequests.length).toBe(1)
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

test('save and start workout', async ({ page }) => {
    const state = buildWorkoutState()
    await seedAuth(page)
    await mockWorkoutApi(page, state)

    await page.goto('/workouts/mode/strength')

    const title = 'E2E силовая • старт'
    await page.getByLabel('Название тренировки').fill(title)
    await page.locator('[data-testid="add-exercise-btn"]').click()

    const dialog = page.locator('[role="dialog"]').last()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Жим лёжа' }).first().click()

    const configDialog = page.locator('[role="dialog"]').last()
    await expect(configDialog).toBeVisible()
    await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()
    await expect(configDialog).toBeHidden()

    await page.locator('[data-testid="save-and-start-btn"]').click()

    await expect.poll(() => state.startRequests.length).toBe(1)
    await expect.poll(() => state.updateSessionRequests.length).toBe(1)
    await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
    await expect(page.getByRole('heading', { name: 'Жим лёжа' }).last()).toBeVisible()
    await expect(page.locator('[data-testid="finish-workout-btn"]')).toBeVisible()
})

test('repeat workout from workouts page', async ({ page }) => {
    const lastWorkoutId = 222
    const lastWorkout: WorkoutHistoryItem = {
        id: lastWorkoutId,
        date: isoNow(),
        duration: 46,
        exercises: [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets_completed: [
                    { set_number: 1, reps: 5, weight: 90, completed: true },
                    { set_number: 2, reps: 5, weight: 90, completed: true },
                ],
            },
        ],
        comments: 'E2E повторить прошлую',
        tags: ['strength'],
        created_at: isoMinutesAgo(24 * 60),
    }
    const state = buildWorkoutState({
        historyItems: [lastWorkout],
        details: new Map([[lastWorkoutId, lastWorkout]]),
    })

    await seedAuth(page)
    await mockWorkoutApi(page, state)

    await page.goto('/workouts')
    await expect(page.locator('[data-testid="repeat-last-workout-btn"]')).toBeVisible({ timeout: 30_000 })

    await page.locator('[data-testid="repeat-last-workout-btn"]').click()

    await expect.poll(() => state.startRequests.length).toBe(1)
    await expect.poll(() => state.updateSessionRequests.length).toBe(1)
    const repeatPayload = state.updateSessionRequests[0]?.payload
    const repeatedExercises = (repeatPayload?.exercises as CompletedExercise[] | undefined) ?? []
    expect(repeatedExercises[0]?.sets_completed[0]?.completed).toBe(false)
    expect(repeatedExercises[0]?.sets_completed[1]?.completed).toBe(false)
    await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
    await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible()
})

test('resume draft from workouts page', async ({ page }) => {
    const draftWorkoutId = 777
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
                ],
            },
        ],
        comments: 'E2E draft resume',
        tags: ['strength'],
        created_at: isoMinutesAgo(10),
    }
    const state = buildWorkoutState({
        historyItems: [draftWorkout],
        details: new Map([[draftWorkoutId, draftWorkout]]),
    })

    await seedAuth(page)
    await seedDraft(page, draftWorkoutId, 'E2E draft resume')
    await mockWorkoutApi(page, state)

    await page.goto('/workouts')
    await expect(page.locator('[data-testid="resume-draft-btn"]')).toBeVisible({ timeout: 30_000 })

    await page.locator('[data-testid="resume-draft-btn"]').click()

    await expect(page).toHaveURL(new RegExp(`/workouts/active/${draftWorkoutId}(?:\\?.*)?$`))
    await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible()
})

test('complete workout', async ({ page }) => {
    const workoutId = 321
    const detail: WorkoutHistoryItem = {
        id: workoutId,
        date: isoNow(),
        duration: undefined,
        exercises: [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets_completed: [
                    { set_number: 1, reps: 5, weight: 80, completed: false },
                ],
            },
        ],
        comments: 'E2E активная сессия',
        tags: ['strength'],
        created_at: isoMinutesAgo(15),
    }
    const state = buildWorkoutState({
        historyItems: [detail],
        details: new Map([[workoutId, detail]]),
    })

    await seedAuth(page)
    await seedDraft(page, workoutId, 'E2E активная сессия')
    await mockWorkoutApi(page, state)

    await page.goto(`/workouts/active/${workoutId}`)
    await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

    await page.locator('[data-testid="set-toggle-btn"]').first().click()
    await expect(page.locator('[data-testid="set-toggle-btn"][class*="green"]').first()).toBeVisible()

    await page.locator('[data-testid="finish-workout-btn"]').click()
    await expect(page.locator('[data-testid="confirm-finish-btn"]')).toBeVisible()
    await page.locator('[data-testid="confirm-finish-btn"]').click()

    await expect.poll(() => state.completeRequests.length).toBe(1)
    await expect(page).toHaveURL(new RegExp(`/workouts/${workoutId}(?:\\?.*)?$`))
    expect(state.completeRequests[0]?.payload.duration).toBeTruthy()
})

test('offline -> reconnect -> sync', async ({ page, context }) => {
    const workoutId = 654
    const detail: WorkoutHistoryItem = {
        id: workoutId,
        date: isoNow(),
        duration: undefined,
        exercises: [
            {
                exercise_id: 1002,
                name: 'Жим лёжа',
                sets_completed: [
                    { set_number: 1, reps: 8, weight: 70, completed: false },
                ],
            },
        ],
        comments: 'E2E офлайн синк',
        tags: ['strength'],
        created_at: isoMinutesAgo(20),
    }
    const state = buildWorkoutState({
        historyItems: [detail],
        details: new Map([[workoutId, detail]]),
    })

    await seedAuth(page)
    await seedDraft(page, workoutId, 'E2E офлайн синк')
    await mockWorkoutApi(page, state)

    await page.goto(`/workouts/active/${workoutId}`)
    await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

    await context.setOffline(true)
    await page.locator('[data-testid="set-toggle-btn"]').first().click()

    const status = page.getByRole('status').filter({ hasText: 'Офлайн' }).first()
    await expect(status).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Офлайн: изменения поставлены в очередь синхронизации')).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)

    await expect.poll(() => state.updateSessionRequests.length, { timeout: 8000 }).toBeGreaterThan(0)
    await expect(page.getByRole('status').filter({ hasText: 'Сохранено' }).first()).toBeVisible({ timeout: 8000 })

    await page.reload()
    await expect(page.locator('[data-testid="set-toggle-btn"][class*="green"]').first()).toBeVisible()
})
})