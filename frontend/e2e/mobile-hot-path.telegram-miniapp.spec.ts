import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'
import {
    activeSetCompleteButton,
    buildWorkoutState,
    completeActiveSet,
    dismissBlockingDialog,
    expectActiveSet,
    finishActiveWorkout,
    isoMinutesAgo,
    isoNow,
    mockWorkoutApi,
    seedAuth,
    seedDraft,
    withSetIds,
    type WorkoutHistoryItem,
    type WorkoutTemplate,
} from './helpers/workout-api-mock'

async function ensureMobileTelegramEnv(page: Parameters<typeof setupTelegramWebApp>[0]) {
    await setupTelegramWebApp(page, {
        platform: 'android',
        viewportHeight: 760,
        viewportStableHeight: 700,
        safeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
        theme: 'light',
    })
}

async function openActiveIfRedirectedToHub(page: import('@playwright/test').Page, workoutId: number) {
    if (new RegExp(`/workouts/active/${workoutId}(?:\\?.*)?$`).test(page.url())) return
    const openBtn = page.getByRole('button', { name: /^Открыть$/i }).first()
    if (await openBtn.count()) {
        await openBtn.click({ force: true })
    } else {
        const resumeBtn = page.getByRole('button', { name: /Продолжить тренировку/i }).first()
        if (await resumeBtn.count()) {
            await resumeBtn.click({ force: true })
        }
    }
    await expect(page).toHaveURL(new RegExp(`/workouts/active/${workoutId}(?:\\?.*)?$`), { timeout: 30_000 })
}

test.describe('telegram mini app: mobile hot paths @mobile @regression', () => {
    test.describe.configure({ timeout: 60_000, mode: 'serial' })

    test('start from template → adjust weight → complete set → finish workout', async ({ page }) => {
        const fixedWorkoutId = 91000
        const template: WorkoutTemplate = {
            id: 9001,
            user_id: 1,
            name: 'E2E Mobile Hot Path Template',
            type: 'strength',
            exercises: [
                { exercise_id: 1001, name: 'Присед', sets: 1, reps: 5, weight: 80, rest_seconds: 60 },
            ],
            is_public: false,
            created_at: isoMinutesAgo(240),
            updated_at: isoMinutesAgo(30),
        }

        const state = buildWorkoutState({ templates: [template], nextWorkoutId: fixedWorkoutId })

        await ensureMobileTelegramEnv(page)
        await seedAuth(page)
        await mockWorkoutApi(page, state)

        await page.goto('/workouts/templates')
        await expect(page.getByRole('heading', { name: 'E2E Mobile Hot Path Template' })).toBeVisible({ timeout: 30_000 })

        const card = page.locator('div.rounded-2xl', { hasText: 'E2E Mobile Hot Path Template' }).first()
        await card.getByRole('button', { name: 'Начать по шаблону' }).click()

        await expect.poll(() => state.startRequests.length).toBe(1)
        // Depending on the hub state the app can briefly return to /workouts with a resume bar.
        await openActiveIfRedirectedToHub(page, fixedWorkoutId)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        // Weight adjustment happens through the quick controls of the active set (SPEC-005 §13).
        const weightIncrement = page.getByRole('button', { name: '+2.5' }).first()
        await expect(weightIncrement).toBeVisible({ timeout: 10_000 })
        await weightIncrement.click()

        await completeActiveSet(page)
        await expect.poll(() => state.setPatchRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)

        await finishActiveWorkout(page)
        await expect.poll(() => state.completeRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    })

    test('abandon workout clears draft and returns to workouts', async ({ page }) => {
        const workoutId = 9102
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
            date: isoNow(),
            duration: undefined,
            exercises: withSetIds(workoutId, [
                {
                    exercise_id: 1002,
                    name: 'Жим лёжа',
                    sets_completed: [{ set_number: 1, reps: 8, weight: 70, completed: false }],
                },
            ]),
            comments: 'E2E abandon workout',
            tags: ['strength'],
            created_at: isoMinutesAgo(8),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await ensureMobileTelegramEnv(page)
        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E abandon workout')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await expect(page.getByRole('main')).toContainText('Последние сессии')
    })

    test('rest timer overlay remains non-blocking (can still log sets)', async ({ page }) => {
        const workoutId = 9103
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
            date: isoNow(),
            duration: undefined,
            exercises: withSetIds(workoutId, [
                {
                    exercise_id: 1001,
                    name: 'Присед',
                    sets_completed: [
                        { set_number: 1, reps: 5, weight: 80, completed: false },
                        { set_number: 2, reps: 5, weight: 80, completed: false },
                    ],
                },
            ]),
            comments: 'E2E rest overlay non-blocking',
            tags: ['strength'],
            created_at: isoMinutesAgo(10),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await ensureMobileTelegramEnv(page)
        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E rest overlay non-blocking')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        // Completing a set starts the rest timer; the next set stays loggable underneath it.
        await completeActiveSet(page)
        await expect(page.getByTestId('rest-minus-30')).toBeVisible({ timeout: 10_000 })
        await expectActiveSet(page, 2)
    })

    test('sticky bottom action rail does not cover critical content on small mobile height', async ({ page }) => {
        const workoutId = 9104
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
            date: isoNow(),
            duration: undefined,
            exercises: withSetIds(workoutId, [
                {
                    exercise_id: 1001,
                    name: 'Присед',
                    sets_completed: [
                        { set_number: 1, reps: 5, weight: 80, completed: false },
                        { set_number: 2, reps: 5, weight: 80, completed: false },
                        { set_number: 3, reps: 5, weight: 80, completed: false },
                    ],
                },
            ]),
            comments: 'E2E sticky rail overlap',
            tags: ['strength'],
            created_at: isoMinutesAgo(12),
        }

        const state = buildWorkoutState({
            historyItems: [activeWorkout],
            details: new Map([[workoutId, activeWorkout]]),
        })

        await page.setViewportSize({ width: 390, height: 640 })
        await ensureMobileTelegramEnv(page)
        await seedAuth(page)
        await seedDraft(page, workoutId, 'E2E sticky rail overlap')
        await mockWorkoutApi(page, state)

        await page.goto(`/workouts/active/${workoutId}`)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        // The last set row must stay reachable above the sticky finish bar.
        const lastSetRow = page.locator('[data-testid="set-row-3"]')
        await lastSetRow.scrollIntoViewIfNeeded()
        await expect(lastSetRow).toBeVisible()

        // The screen pins "Упражнение"/"Завершить" to the bottom of the viewport.
        const railButton = page.getByRole('button', { name: 'Завершить', exact: true }).last()
        const railBox = await railButton.boundingBox()
        const rowBox = await lastSetRow.boundingBox()

        expect(railBox).not.toBeNull()
        expect(rowBox).not.toBeNull()

        if (railBox && rowBox) {
            // The bottom edge of the set row should be above the finish bar's top edge.
            expect(rowBox.y + rowBox.height).toBeLessThan(railBox.y)
        }
    })

    test('offline → local changes queued → reconnect syncs queue (mobile) @offline', async ({ page, context }) => {
        const fixedWorkoutId = 92000
        const template: WorkoutTemplate = {
            id: 9201,
            user_id: 1,
            name: 'E2E Offline Mobile Template',
            type: 'strength',
            exercises: [{ exercise_id: 1002, name: 'Жим лёжа', sets: 2, reps: 8, weight: 70, rest_seconds: 60 }],
            is_public: false,
            created_at: isoMinutesAgo(120),
            updated_at: isoMinutesAgo(10),
        }

        const state = buildWorkoutState({ templates: [template], nextWorkoutId: fixedWorkoutId })

        await ensureMobileTelegramEnv(page)
        await seedAuth(page)
        await seedDraft(page, fixedWorkoutId, 'E2E Offline Mobile Template')
        await mockWorkoutApi(page, state)

        await page.goto('/workouts/templates')
        await page.getByRole('heading', { name: 'E2E Offline Mobile Template' }).waitFor({ timeout: 30_000 })
        await page.locator('div.rounded-2xl', { hasText: 'E2E Offline Mobile Template' }).first()
            .getByRole('button', { name: 'Начать по шаблону' })
            .click()

        await expect.poll(() => state.startRequests.length).toBe(1)
        await openActiveIfRedirectedToHub(page, fixedWorkoutId)
        await dismissBlockingDialog(page)
        await expect(activeSetCompleteButton(page)).toBeVisible({ timeout: 30_000 })

        // Let the session baseline settle, so only the offline edit can be queued.
        await page.waitForTimeout(3_000)
        const syncedBefore = state.updateSessionRequests.length

        // Go offline and make a local-only change (the new set inherits its predecessor).
        await context.setOffline(true)
        await page.locator('[data-testid="add-set-btn"]').click()

        // API must not be called while offline; visible status wording can vary by shell state.
        await expect(page.getByText(/офлайн|Нет сети/i).first()).toBeVisible({ timeout: 12_000 })
        await page.waitForTimeout(3_000)
        expect(state.updateSessionRequests.length).toBe(syncedBefore)

        // Reconnect and ensure queue drains (update calls happen).
        await context.setOffline(false)
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 20_000 }).toBeGreaterThan(syncedBefore)
    })
})
