/**
 * Complete workout flow on the current active-workout screen.
 *
 * Covers the three things this suite owns that the golden-path specs do not:
 * 1. completing every planned set carries the session to the summary,
 * 2. a set cannot be completed while its weight is empty (SPEC-005 §13),
 * 3. an empty quick-start workout can add its first exercise.
 *
 * API is mocked through the shared harness (helpers/workout-api-mock).
 */

import { expect, test } from '@playwright/test'
import {
    type WorkoutHistoryItem,
    activeSetCompleteButton,
    buildWorkoutState,
    completeActiveSet,
    dismissBlockingDialog,
    expectSetCompleted,
    finishActiveWorkout,
    isoMinutesAgo,
    isoNow,
    mockWorkoutApi,
    seedAuth,
    seedDraft,
    withSetIds,
} from './helpers/workout-api-mock'

const startedAt = () => isoMinutesAgo(18)

function activeSession(workoutId: number, sets: Array<{ set_number: number; reps: number; weight: number }>): WorkoutHistoryItem {
    return {
        id: workoutId,
        date: isoNow(),
        duration: undefined,
        exercises: withSetIds(workoutId, [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets_completed: sets.map((set) => ({ ...set, completed: false })),
            },
        ]),
        comments: 'E2E complete flow',
        tags: ['strength'],
        created_at: startedAt(),
    }
}

test.describe('complete workout flow @regression', () => {
    // The screen arrives through several lazily loaded chunks; on a loaded machine a single
    // chunk can take seconds, so readiness waits are generous rather than tight.
    test.describe.configure({ timeout: 150_000 })

    test('completing every planned set reaches the summary with the logged sets', async ({ page }) => {
        const workoutId = 7301
        const session = activeSession(workoutId, [
            { set_number: 1, reps: 5, weight: 80 },
            { set_number: 2, reps: 5, weight: 80 },
        ])
        const state = buildWorkoutState({
            historyItems: [session],
            details: new Map([[workoutId, session]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E complete flow')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 60_000 })

        await completeActiveSet(page)
        await expectSetCompleted(page, 1)
        await completeActiveSet(page)
        await expectSetCompleted(page, 2)

        await finishActiveWorkout(page)
        await expect.poll(() => state.completeRequests.length, { timeout: 20_000 }).toBe(1)

        type PersistedExercise = { sets_completed?: Array<{ completed?: boolean }> }
        const payloadSets = ((state.completeRequests[0]?.payload.exercises ?? []) as PersistedExercise[])
            .flatMap((exercise) => exercise.sets_completed ?? [])
        expect(payloadSets.filter((set) => set.completed).length).toBe(2)
    })

    test('keeps the set pending while its weight is empty', async ({ page }) => {
        const workoutId = 7302
        const session = activeSession(workoutId, [{ set_number: 1, reps: 5, weight: 0 }])
        const state = buildWorkoutState({
            historyItems: [session],
            details: new Map([[workoutId, session]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E complete flow')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        const completeButton = activeSetCompleteButton(page)
        await expect(completeButton).toBeVisible({ timeout: 60_000 })

        // No weight entered: the app refuses the set and explains why (§13).
        await completeButton.click()
        await expect(page.getByText('Заполните вес больше 0')).toBeVisible({ timeout: 10_000 })
        expect(state.setPatchRequests.length).toBe(0)
        await expect(activeSetCompleteButton(page)).toBeVisible()
    })

    test('quick start opens an empty workout and can add the first exercise', async ({ page }) => {
        const state = buildWorkoutState()

        await seedAuth(page)
        await mockWorkoutApi(page, state)

        await page.goto('/workouts')
        await page.locator('[data-testid="start-workout-main-btn"]').click()
        await page.getByRole('button', { name: /Пустая тренировка/ }).click()

        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/, { timeout: 60_000 })
        await dismissBlockingDialog(page)

        // The empty session shows the placeholder plus its add action.
        await expect(page.getByText('Нет упражнений')).toBeVisible({ timeout: 60_000 })

        // The picker is a full-screen sheet, not a [role=dialog]. It covers the button that opens
        // it, so a retrying click can report interception *after* the tap landed: the sheet
        // itself is the signal.
        const catalogSearch = page.getByPlaceholder('Поиск по упражнениям')
        await page
            .getByRole('button', { name: 'Добавить упражнение' })
            .first()
            .click({ timeout: 5_000 })
            .catch(() => undefined)
        await expect(catalogSearch).toBeVisible({ timeout: 15_000 })
        await catalogSearch.fill('Присед')
        await page.getByRole('button', { name: 'Присед' }).first().click()

        // The sheet is portalled to the end of the body, so its submit is the last button with
        // this label; it stays disabled until an exercise is selected.
        const confirm = page.getByRole('button', { name: 'Добавить упражнение' }).last()
        await expect(confirm).toBeEnabled({ timeout: 10_000 })
        await confirm.click().catch(() => undefined)

        await expect(catalogSearch).toBeHidden({ timeout: 20_000 })
        await expect(page.getByText('Нет упражнений')).toBeHidden({ timeout: 20_000 })
        await expect(page.locator('[data-testid^="set-row-"]').first()).toBeVisible({ timeout: 20_000 })
    })
})
