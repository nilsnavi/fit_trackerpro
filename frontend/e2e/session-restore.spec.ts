/**
 * SPEC-005 §48: restore prompt for an unfinished session.
 *
 * The prompt (detector + dialog) is code-split out of the entry bundle, so this
 * spec also guards that the lazy gate in App.tsx actually mounts and decides.
 */

import { expect, test } from '@playwright/test'
import {
    buildWorkoutState,
    mockWorkoutApi,
    seedAuth,
    withSetIds,
    type WorkoutHistoryItem,
} from './helpers/workout-api-mock'

const startedAt = new Date(Date.now() - 25 * 60_000)

const openSession: WorkoutHistoryItem = {
    id: 901,
    date: startedAt.toISOString().slice(0, 10),
    exercises: withSetIds(901, [
        {
            exercise_id: 1001,
            name: 'Присед',
            sets_completed: [{ set_number: 1, reps: 8, weight: 60, completed: true }],
        },
    ]),
    created_at: startedAt.toISOString(),
    status: 'active',
    started_at: startedAt.toISOString(),
}

test.describe('restore prompt: unfinished workout @regression', () => {
    test('prompts on app start and continues the session', async ({ page }) => {
        await seedAuth(page)
        await mockWorkoutApi(
            page,
            buildWorkoutState({
                historyItems: [openSession],
                details: new Map([[openSession.id, openSession]]),
            }),
        )

        await page.goto('/')

        const dialog = page.getByTestId('session-restore-dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog).toContainText('У вас есть незавершённая тренировка')

        await page.getByTestId('restore-continue-btn').click()
        await expect(page).toHaveURL(/\/workouts\/active\/901/)
    })
})
