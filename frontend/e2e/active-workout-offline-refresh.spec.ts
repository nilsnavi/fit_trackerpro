import { expect, test } from '@playwright/test'
import {
    type WorkoutHistoryItem,
    activeSetCompleteButton,
    buildWorkoutState,
    completeActiveSet,
    dismissBlockingDialog,
    expectActiveSet,
    expectSetCompleted,
    isoMinutesAgo,
    isoNow,
    mockWorkoutApi,
    seedAuth,
    seedDraft,
    withSetIds,
} from './helpers/workout-api-mock'

const APP_BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

function activeSession(workoutId: number, exerciseId: number, name: string, sets: number[], comment: string): WorkoutHistoryItem {
    return {
        id: workoutId,
        date: isoNow(),
        duration: undefined,
        exercises: withSetIds(workoutId, [
            {
                exercise_id: exerciseId,
                name,
                sets_completed: sets.map((weight, index) => ({
                    set_number: index + 1,
                    reps: 8,
                    weight,
                    completed: false,
                })),
            },
        ]),
        comments: comment,
        tags: ['strength'],
        created_at: isoMinutesAgo(12),
    }
}

/** Queued session snapshot as the mock received it. */
function flushedSetCount(state: { updateSessionRequests: Array<{ payload: Record<string, unknown> }> }): number {
    const payload = state.updateSessionRequests.at(-1)?.payload as
        | { exercises?: Array<{ sets_completed?: unknown[] }> }
        | undefined
    return payload?.exercises?.[0]?.sets_completed?.length ?? 0
}

test.describe('active workout offline/refresh flows @regression', () => {
    test.describe.configure({ timeout: 90_000 })

    test('refresh keeps active workout progress', async ({ page }) => {
        const workoutId = 4101
        const session = activeSession(workoutId, 1001, 'Присед', [80, 80], 'E2E refresh flow')
        const state = buildWorkoutState({
            historyItems: [session],
            details: new Map([[workoutId, session]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E refresh flow')
        await mockWorkoutApi(page, state)

        await page.goto(`${APP_BASE_URL}/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        // The set rows are the screen's own signal; "Прогресс" also labels a bottom-nav link.
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        await completeActiveSet(page)
        await expectSetCompleted(page, 1)

        await page.reload()

        await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}(?:\\?.*)?$`))
        await dismissBlockingDialog(page)
        // The set logged before the reload is still completed and the session moved on to #2.
        await expectSetCompleted(page, 1)
        await expectActiveSet(page, 2)
    })

    test('offline edits are queued locally and synced after reconnect', async ({ page, context }) => {
        const workoutId = 4102
        const session = activeSession(workoutId, 1002, 'Жим лёжа', [70], 'E2E offline recovery flow')
        const state = buildWorkoutState({
            historyItems: [session],
            details: new Map([[workoutId, session]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E offline recovery flow')
        await mockWorkoutApi(page, state)

        await page.goto(`${APP_BASE_URL}/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        // Let the session baseline settle first, so only the offline edit can be queued.
        await page.waitForTimeout(3_000)
        const syncedBefore = state.updateSessionRequests.length

        await context.setOffline(true)
        // A local-only session edit (SPEC-005 §11: the new set inherits the previous one).
        await page.locator('[data-testid="add-set-btn"]').click()

        await expect(page.getByRole('status').filter({ hasText: 'Нет сети' }).first()).toBeVisible({ timeout: 12_000 })
        await expect(
            page.getByRole('status').filter({ hasText: 'сохранено локально' }).first(),
        ).toBeVisible({ timeout: 12_000 })
        await page.waitForTimeout(3_000)
        // Nothing left the device: the edit is only in the local queue.
        expect(state.updateSessionRequests.length + state.setPatchRequests.length).toBe(0)
        await expect(page.locator('[data-testid^="set-row-"]')).toHaveCount(2)

        await context.setOffline(false)
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 20_000 }).toBeGreaterThan(syncedBefore)
        // The queued session reached the server with both sets, and the screen kept them.
        await expect.poll(() => flushedSetCount(state), { timeout: 20_000 }).toBe(2)
        await expect(page.locator('[data-testid^="set-row-"]')).toHaveCount(2)
    })

    test('completing a set is refused while offline', async ({ page, context }) => {
        const workoutId = 4103
        const session = activeSession(workoutId, 1003, 'Становая', [100], 'E2E offline set completion')
        const state = buildWorkoutState({
            historyItems: [session],
            details: new Map([[workoutId, session]]),
        })

        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E offline set completion')
        await mockWorkoutApi(page, state)

        await page.goto(`${APP_BASE_URL}/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        await context.setOffline(true)
        await activeSetCompleteButton(page).click()
        await expect(page.getByRole('status').filter({ hasText: 'Нет сети' }).first()).toBeVisible({ timeout: 12_000 })

        // Set completion is a server write and the app does not queue it: nothing is sent and
        // the row stays pending, so the set can be logged properly once the connection is back.
        await page.waitForTimeout(3_000)
        expect(state.setPatchRequests.length).toBe(0)
        await expect(activeSetCompleteButton(page)).toBeVisible()
    })
})
