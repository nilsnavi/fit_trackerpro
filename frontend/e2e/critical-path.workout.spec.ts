/**
 * Critical path: sign in, resume the unfinished session the app offers on start, log a set,
 * finish the workout and find it completed in the workouts hub.
 *
 * SPEC-005 moved the active session to its own screen (rows with a "Завершить подход" control)
 * and made §48 the resume entry point, so this spec drives those instead of the removed
 * "Детали тренировки" / "Отметить" / finish-workout-btn flow.
 *
 * The API is mocked through the shared harness (helpers/workout-api-mock).
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

const WORKOUT_TITLE = 'E2E критический путь'

test('critical path: login → open workout → complete → see in history', async ({ page }) => {
    test.setTimeout(90_000)

    const workoutId = 8101
    const session: WorkoutHistoryItem = {
        id: workoutId,
        date: isoNow(),
        duration: undefined,
        exercises: withSetIds(workoutId, [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets_completed: [{ set_number: 1, reps: 5, weight: 60, completed: false }],
            },
        ]),
        comments: WORKOUT_TITLE,
        tags: ['strength'],
        created_at: isoMinutesAgo(20),
    }
    const state = buildWorkoutState({
        historyItems: [session],
        details: new Map([[workoutId, session]]),
    })

    await seedAuth(page)
    await seedDraft(page, workoutId, WORKOUT_TITLE)
    await mockWorkoutApi(page, state)

    // The app offers the unfinished session on start (SPEC-005 §48); "Продолжить" opens it.
    await page.goto('/workouts')
    const restorePrompt = page.getByTestId('session-restore-dialog')
    await expect(restorePrompt).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('restore-continue-btn').click()
    await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}(?:\\?.*)?$`), { timeout: 30_000 })
    await dismissBlockingDialog(page)

    // Log the planned set and finish the workout.
    await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })
    await completeActiveSet(page)
    await expectSetCompleted(page, 1)
    await finishActiveWorkout(page)
    await expect.poll(() => state.completeRequests.length, { timeout: 20_000 }).toBe(1)

    // Back in the hub the session is completed rather than still in progress.
    await page.goto('/workouts')
    const sessionRow = page.getByRole('button').filter({ hasText: WORKOUT_TITLE })
    await expect(sessionRow.first()).toBeVisible({ timeout: 30_000 })
    await expect(sessionRow.first().getByText('В процессе')).toHaveCount(0)
})
