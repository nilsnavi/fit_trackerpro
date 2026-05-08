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
test.describe.configure({ mode: 'serial', timeout: 60_000 })

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
    await dialog.getByRole('button', { name: 'Присед' }).first().click({ force: true })

    const configDialog = page.locator('[role="dialog"]').last()
    await expect(configDialog).toBeVisible()
    await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()

    await expect(page.locator('#workout-mode-exercises').getByText('Присед')).toBeVisible()
    await expect(configDialog).toBeHidden()
    await expect(page.locator('[data-testid="save-btn"]')).toBeEnabled({ timeout: 15_000 })
    await page.locator('[data-testid="save-btn"]').click()

    await expect.poll(() => state.createTemplateRequests.length).toBe(1)
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
    await expect(page.getByRole('main')).toContainText('История')
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
    await expect(page.getByRole('button', { name: 'Завершить', exact: true })).toBeVisible()
})

test('create template -> start workout -> log sets -> complete -> open history', async ({ page }) => {
    test.setTimeout(120_000)
    const state = buildWorkoutState()
    await seedAuth(page)
    await mockWorkoutApi(page, state)

    await page.goto('/workouts/mode/strength')

    const title = 'E2E полный критический путь'
    await page.getByLabel('Название тренировки').fill(title)
    await page.locator('[data-testid="add-exercise-btn"]').click()

    const searchDialog = page.locator('[role="dialog"]').last()
    await expect(searchDialog).toBeVisible()
    await searchDialog.getByRole('button', { name: 'Присед' }).first().click()

    const configDialog = page.locator('[role="dialog"]').last()
    await expect(configDialog).toBeVisible()
    await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()
    await expect(configDialog).toBeHidden()

    await page.locator('[data-testid="save-btn"]').click()
    await expect.poll(() => state.createTemplateRequests.length).toBe(1)
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)

    await page.getByRole('button', { name: new RegExp(`Начать по шаблону ${title}`) }).first().click()

    await expect.poll(() => state.startRequests.length).toBe(1)
    await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible()

    const firstSetCompleteButton = page.getByRole('button', { name: 'Отметить подход 1 выполненным' })
    await firstSetCompleteButton.dispatchEvent('click')
    await expect(page.getByLabel('Подход выполнен').first()).toBeVisible()
    await expect.poll(() => state.updateSessionRequests.length, { timeout: 10_000 }).toBeGreaterThan(0)

    const skipRestTimer = page.getByRole('button', { name: 'Skip' })
    if (await skipRestTimer.isVisible().catch(() => false)) {
        await skipRestTimer.click()
    }

    await page.getByRole('button', { name: 'Завершить', exact: true }).click()
    await expect(page.getByText('Завершить тренировку?')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'Завершить', exact: true }).last().click()

    await expect(page).toHaveURL(/\/workouts\/active\/\d+\/summary(?:\?.*)?$/, { timeout: 30_000 })
    await page.getByRole('button', { name: 'Завершить тренировку' }).click()
    await expect(page.getByText('Завершение тренировки')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('confirm-finish-btn').click()

    await expect.poll(() => state.completeRequests.length, { timeout: 45_000 }).toBe(1)
    await expect(page).toHaveURL(/\/workouts\/\d+(?:\?.*)?$/, { timeout: 30_000 })

    await page.goto('/workouts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Последние сессии' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Мои шаблоны' })).toBeVisible()
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
    const lastWorkoutSection = page.locator('section').filter({ hasText: 'Последняя тренировка' }).first()
    const repeatLastButton = lastWorkoutSection.getByRole('button', { name: 'Повторить', exact: true })
    await expect(repeatLastButton).toBeVisible({ timeout: 30_000 })

    await repeatLastButton.evaluate((button: HTMLElement) => button.click())

    await expect.poll(() => state.startRequests.length).toBe(1)
    await expect.poll(() => state.updateSessionRequests.length).toBe(1)
    const repeatPayload = state.updateSessionRequests[0]?.payload
    const repeatedExercises = (repeatPayload?.exercises as CompletedExercise[] | undefined) ?? []
    expect(repeatedExercises[0]?.sets_completed[0]?.completed).toBe(false)
    expect(repeatedExercises[0]?.sets_completed[1]?.completed).toBe(false)
    await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible()
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
    const activeWorkoutLink = page.getByRole('link', { name: /Открыть активную тренировку|Активная тренировка/ }).first()
    await expect(activeWorkoutLink).toBeVisible({ timeout: 30_000 })

    await activeWorkoutLink.click()

    await expect(page).toHaveURL(new RegExp(`/workouts/active/${draftWorkoutId}(?:\\?.*)?$`))
    await expect(page.getByRole('heading', { name: 'Жим лёжа' }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible()
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
                    { set_number: 2, reps: 5, weight: 80, completed: false },
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
    await expect(page.getByRole('heading', { name: 'Присед' }).last()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Отметить подход 1 выполненным' }).click()
    await expect.poll(() => state.updateSessionRequests.length, { timeout: 10_000 }).toBeGreaterThan(0)

    // Completing the last remaining set opens the summary step before final save.
    await page.getByRole('button', { name: 'Отметить подход 2 выполненным' }).click()

    await page.getByRole('button', { name: 'Завершить', exact: true }).click()
    await expect(page.getByText('Завершить тренировку?')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'Завершить', exact: true }).last().click()
    await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}/summary(?:\\?.*)?$`))
    await page.getByRole('button', { name: 'Завершить тренировку' }).click()
    await expect(page.getByText('Завершение тренировки')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('confirm-finish-btn').click()

    await expect.poll(() => state.completeRequests.length).toBe(1)
    await expect(page).toHaveURL(new RegExp(`/workouts/${workoutId}(?:\\?.*)?$`))
    expect(state.completeRequests[0]?.payload.duration).toBeTruthy()
})

test('auto-complete workout on last "Готово" tap', async ({ page }) => {
    const workoutId = 322
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
        comments: 'E2E авто-завершение по готово',
        tags: ['strength'],
        created_at: isoMinutesAgo(8),
    }
    const state = buildWorkoutState({
        historyItems: [detail],
        details: new Map([[workoutId, detail]]),
    })

    await seedAuth(page)
    await seedDraft(page, workoutId, 'E2E авто-завершение по готово')
    await mockWorkoutApi(page, state)

    await page.goto(`/workouts/active/${workoutId}`)
    await expect(page.getByRole('heading', { name: 'Присед' }).last()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible({ timeout: 30_000 })

    // One incomplete set in session: marking it done opens the summary step before final save.
    await page.getByRole('button', { name: 'Отметить подход 1 выполненным' }).click()

    await page.getByRole('button', { name: 'Завершить', exact: true }).click()
    await expect(page.getByText('Завершить тренировку?')).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'Завершить', exact: true }).last().click()
    await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}/summary(?:\\?.*)?$`))
    await page.getByRole('button', { name: 'Завершить тренировку' }).click()
    await expect(page.getByText('Завершение тренировки')).toBeVisible({ timeout: 45_000 })
    await page.getByTestId('confirm-finish-btn').click()

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
                    { set_number: 2, reps: 8, weight: 70, completed: false },
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
    await expect(page.getByRole('button', { name: 'Отметить подход 1 выполненным' })).toBeVisible({ timeout: 30_000 })

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Отметить подход 1 выполненным' }).click()

    const status = page.getByRole('status').filter({ hasText: 'Нет сети' }).first()
    await expect(status).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/сохранено локально/)).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)

    await expect.poll(() => state.updateSessionRequests.length, { timeout: 8000 }).toBeGreaterThan(0)

    await page.reload()
    await expect(page.getByLabel('Подход выполнен').first()).toBeVisible()
})
})
