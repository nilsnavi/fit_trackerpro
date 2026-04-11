import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'
import {
    buildWorkoutState,
    isoMinutesAgo,
    isoNow,
    mockWorkoutApi,
    seedAuth,
    seedDraft,
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

async function expandActionRailIfCollapsed(page: import('@playwright/test').Page) {
    const handle = page.getByRole('button', { name: /Показать панель управления|Скрыть панель управления/i }).first()
    if ((await handle.count()) === 0) return
    const label = await handle.getAttribute('aria-label')
    if (label && /Показать панель управления/i.test(label)) {
        await handle.click({ force: true })
    }
}

async function seedActiveWorkoutDraft(page: import('@playwright/test').Page, workoutId: number, title: string) {
    await page.evaluate(({ workoutId, title }) => {
        localStorage.setItem('workout-session-draft', JSON.stringify({
            state: { workoutId, title, updatedAt: Date.now() },
            version: 0,
        }))
    }, { workoutId, title })
}

test.describe('telegram mini app: mobile hot paths @mobile @regression', () => {
    test.describe.configure({ timeout: 60_000, mode: 'serial' })

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

    test('start from template → adjust weight → complete set → add new set → finish workout', async ({ page }) => {
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
        // Depending on the current hub state, the UI can redirect back to /workouts with a "resume/open" bar.
        await openActiveIfRedirectedToHub(page, fixedWorkoutId)
        // Ensure we are on the active workout screen (if we got redirected back to hub again).
        await openActiveIfRedirectedToHub(page, fixedWorkoutId)
        await expect(page.locator('[data-testid="set-row"]').first()).toBeVisible({ timeout: 30_000 })
        await expandActionRailIfCollapsed(page)
        await expect(page.locator('[data-testid="finish-workout-btn"]')).toHaveCount(1)

        // Active set row (avoids matching set #1 on a non-current exercise when several blocks exist).
        const firstRow = page.locator('[data-testid="set-row"][data-current="true"]').first()
        await expect(firstRow).toBeVisible({ timeout: 30_000 })
        const weightInc = firstRow.locator('[data-testid="set-weight-inc-btn"]')
        await expect(weightInc).toBeVisible({ timeout: 10_000 })
        await weightInc.click({ force: true })
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 25_000 }).toBeGreaterThan(0)

        // Complete set.
        await firstRow.locator('[data-testid="set-toggle-btn"]').click({ force: true })
        await expect.poll(() => state.details.get(fixedWorkoutId)?.exercises[0]?.sets_completed[0]?.completed ?? false, {
            timeout: 25_000,
        }).toBe(true)

        // Add new set via sticky action rail.
        await expandActionRailIfCollapsed(page)
        await page.getByRole('button', { name: '+ Подход' }).first().click()
        await expect(page.locator('[data-testid="set-row"][data-set-number="2"]')).toBeVisible({ timeout: 10_000 })
        // Debounced PATCH may coalesce several edits into one request; assert session shape instead.
        await expect.poll(() => state.details.get(fixedWorkoutId)?.exercises[0]?.sets_completed.length ?? 0, {
            timeout: 25_000,
        }).toBeGreaterThanOrEqual(2)

        // Finish workout via rail CTA (mobile primary path).
        await expandActionRailIfCollapsed(page)
        await page.locator('[data-testid="finish-workout-btn"]').click({ force: true })
        await expect(page.getByRole('heading', { name: /Завершить тренировку|Детали тренировки/i })).toBeVisible({ timeout: 30_000 })
        await expect.poll(() => state.completeRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
    })

    test('abandon workout clears draft and returns to workouts', async ({ page }) => {
        const workoutId = 9102
        const activeWorkout: WorkoutHistoryItem = {
            id: workoutId,
            date: isoNow(),
            duration: undefined,
            exercises: [
                {
                    exercise_id: 1002,
                    name: 'Жим лёжа',
                    sets_completed: [{ set_number: 1, reps: 8, weight: 70, completed: false }],
                },
            ],
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
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: 'Отменить тренировку' }).click()
        await expect(page.getByRole('heading', { name: 'Отменить тренировку?' })).toBeVisible()
        await page.getByRole('button', { name: 'Подтвердить отмену' }).click()

        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await expect(page.getByRole('main')).toContainText('История')
    })

    test('rest timer overlay remains non-blocking (can still log sets) @mobile', async ({ page }) => {
        const workoutId = 9103
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
        const firstToggle = page.locator('[data-testid="set-toggle-btn"]').first()
        await firstToggle.scrollIntoViewIfNeeded()
        await expect(firstToggle).toBeVisible({ timeout: 30_000 })

        // Start rest (opens overlay). Depending on layout it can be on summary card.
        const restBtn = page.getByRole('button', { name: /^Отдых\b/i }).first()
        if (await restBtn.count()) {
            await restBtn.click()
            await expect(page.getByText('Отдых').first()).toBeVisible({ timeout: 10_000 })
        }

        // Even with overlay, we should be able to mark set as done (no hard block).
        await firstToggle.click({ force: true })
        await expect(firstToggle).toContainText('✓', { timeout: 10_000 })
    })

    test('sticky bottom action rail does not cover critical content on small mobile height', async ({ page }) => {
        const workoutId = 9104
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
                        { set_number: 3, reps: 5, weight: 80, completed: false },
                    ],
                },
            ],
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
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('[data-testid="finish-workout-btn"]')).toHaveCount(1)
        await expandActionRailIfCollapsed(page)

        // Ensure last set action remains tappable and not hidden under the rail.
        const lastSetToggle = page.locator('[data-testid="set-toggle-btn"]').last()
        await lastSetToggle.scrollIntoViewIfNeeded()
        await expect(lastSetToggle).toBeVisible()

        const railBtn = page.locator('[data-testid="finish-workout-btn"]')
        const railBox = await railBtn.boundingBox()
        const toggleBox = await lastSetToggle.boundingBox()

        expect(railBox).not.toBeNull()
        expect(toggleBox).not.toBeNull()

        if (railBox && toggleBox) {
            // The bottom edge of the toggle should be above the rail's top edge.
            expect(toggleBox.y + toggleBox.height).toBeLessThan(railBox.y)
        }
    })

    test('offline → local changes queued → reconnect syncs queue (mobile) @mobile @offline', async ({ page, context }) => {
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
        await expect(page).toHaveURL(new RegExp(`/workouts/active/${fixedWorkoutId}(?:\\?.*)?$`))
        const firstToggle = page.locator('[data-testid="set-toggle-btn"]').first()
        await firstToggle.scrollIntoViewIfNeeded()
        await expect(firstToggle).toBeVisible({ timeout: 30_000 })
        await expandActionRailIfCollapsed(page)
        await expect(page.locator('[data-testid="finish-workout-btn"]')).toHaveCount(1)

        // Go offline and make local changes.
        await context.setOffline(true)
        await firstToggle.click({ force: true })
        await expandActionRailIfCollapsed(page)
        const addSet = page.getByRole('button', { name: '+ Подход' }).first()
        await addSet.click({ force: true })

        // Expect UI to indicate queued/offline state; API must not be called while offline.
        const offlineStatus = page.getByRole('status').filter({ hasText: /Офлайн|очереди|В очереди/i }).first()
        await expect(offlineStatus).toBeVisible({ timeout: 12_000 })
        await expect.poll(() => state.updateSessionRequests.length).toBe(0)

        // Reconnect and ensure queue drains (update calls happen).
        await context.setOffline(false)
        await expect.poll(() => state.updateSessionRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
        await expect(page.getByRole('status').filter({ hasText: 'Сохранено' }).first()).toBeVisible({ timeout: 12_000 })
    })
})

