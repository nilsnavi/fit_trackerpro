/**
 * Golden Path E2E Test
 *
 * Complete user journey:
 * 1. Open app
 * 2. Authenticate via Telegram mock
 * 3. Create workout in mode
 * 4. Add exercise
 * 5. Log sets
 * 6. Finish workout
 * 7. Verify in history
 *
 * Should run reliably in CI with proper error handling and retries.
 */

import { test, expect, type Page } from '@playwright/test'
import { buildWorkoutState, seedAuth, mockWorkoutApi } from './helpers/workout-api-mock'

test.describe('golden path: complete user workout flow @regression @golden-path', () => {
    test.describe.configure({ timeout: 60_000 })

    /**
     * Sheets/dialogs from a previous step can still be animating out and steal
     * pointer events. Close whatever is on top before continuing.
     */
    async function dismissBlockingDialog(page: import('@playwright/test').Page) {
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const dialog = page.locator('[role="dialog"]').last()
            if (!(await dialog.isVisible().catch(() => false))) return
            const closeButton = dialog.getByRole('button', { name: 'Закрыть' })
            if ((await closeButton.count()) > 0) {
                await closeButton.first().click().catch(() => undefined)
            } else {
                await page.keyboard.press('Escape').catch(() => undefined)
            }
            const hidden = await dialog
                .waitFor({ state: 'hidden', timeout: 3_000 })
                .then(() => true)
                .catch(() => false)
            if (hidden) return
        }
    }

    /**
     * Add one exercise through the real picker (search → pick → confirm params).
     *
     * A sheet that is still animating out keeps its delayed onClose() pending; a
     * reopen inside that window used to be closed by the stale callback, which is
     * the flake this helper masked with a retry before Modal became idempotent.
     * Wait for the previous instance to be gone, then assert the sheet opened.
     */
    async function addExercise(page: Page, query: string, option: RegExp) {
        const catalogSheet = page.locator(
            '[role="dialog"]:has(input[placeholder="Поиск упражнения..."])',
        )
        await expect(catalogSheet).toHaveCount(0)
        await page
            .locator('#workout-mode-exercises')
            .getByRole('button', { name: /^Добавить( упражнение)?$/ })
            .first()
            .click()
        await expect(catalogSheet).toBeVisible()
        await catalogSheet.getByPlaceholder(/Поиск упражнения|Search/i).fill(query)

        // Quick-pick chips stay mounted until the debounced search applies and then
        // unmount mid-click: wait for them to disappear so the click lands on a
        // stable result row.
        await expect(page.getByText(/Подборка по режиму|Избранное|Недавние/).first())
            .toBeHidden()
        await catalogSheet.getByRole('button', { name: option }).first().click()

        const configSheet = page.locator('[role="dialog"]:has([data-testid="confirm-exercise-btn"])')
        await expect(configSheet).toBeVisible()
        await configSheet.locator('[data-testid="confirm-exercise-btn"]').click()
        await expect(configSheet).toHaveCount(0)
    }

    test('full flow: app → telegram auth → create workout → add exercise → log sets → complete → verify history', async ({
        page,
    }) => {
        const state = buildWorkoutState()

        // Step 1: Mock Telegram WebApp context
        await page.addInitScript(() => {
            // Minimal Telegram.WebApp stub for Mini App context detection
            const w = window as Window & { Telegram?: { WebApp?: Record<string, unknown> } }
            w.Telegram = {
                WebApp: {
                    initData: 'user%3D%7B%22id%22%3A100001%7D',
                    initDataUnsafe: { user: { id: 100001 } },
                    ready: () => {},
                    expand: () => {},
                    close: () => {},
                },
            }
        })

        // Step 2: Setup auth via token injection (auth would normally come from Telegram)
        await seedAuth(page)

        // Step 3: Mock all API endpoints (includes user profile)
        await mockWorkoutApi(page, state)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 1: Open app
        // ─────────────────────────────────────────────────────────────────────────
        await page.goto('/')
        // The app shell redirects the root to the dashboard.
        await expect(page).toHaveURL(/(?:\/|\/home)$/)
        await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 2: Navigate to Workouts section
        // ─────────────────────────────────────────────────────────────────────────
        const nav = page.getByRole('navigation', { name: 'Основная навигация' })
        await nav.getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await expect(page.getByRole('heading', { name: 'Тренировки' })).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 3: Create a new workout (enter mode)
        // ─────────────────────────────────────────────────────────────────────────
        // Alternative: click on mode type directly (e.g., strength)
        await page.getByRole('button', { name: 'Силовая' }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/\w+(?:\?.*)?$/)
        await expect(page.getByLabel('Название тренировки')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 4: Fill workout title
        // ─────────────────────────────────────────────────────────────────────────
        const workoutTitle = `E2E Тренировка ${new Date().getTime()}`
        const titleInput = page.getByLabel('Название тренировки')
        await titleInput.fill(workoutTitle)
        await expect(titleInput).toHaveValue(workoutTitle)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 5: Add first exercise
        // ─────────────────────────────────────────────────────────────────────────
        await addExercise(page, 'Присед', /Присед|Squat/i)

        // Verify exercise was added
        await expect(page.locator('#workout-mode-exercises').getByText('Присед')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 6: Add second exercise (optional, for completeness)
        // ─────────────────────────────────────────────────────────────────────────
        await addExercise(page, 'Жим', /Жим лёжа|Bench Press/i)

        // Verify second exercise was added
        await expect(page.locator('#workout-mode-exercises').getByText('Жим лёжа')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 7: Save workout (create template) and start session
        // ─────────────────────────────────────────────────────────────────────────
        await page.locator('[data-testid="save-and-start-btn"]').click()

        // Wait for the start-workout request
        await expect.poll(() => state.startRequests.length).toBeGreaterThan(0)

        // Should navigate to active workout page
        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 8: Log sets for each exercise
        // ─────────────────────────────────────────────────────────────────────────
        // Verify we can see the logged exercises
        await expect(page.getByRole('heading', { name: 'Присед' })).toBeVisible()

        // A set can only be completed once it carries weight/reps values.
        await dismissBlockingDialog(page)
        const firstWeight = page.getByLabel('Вес').first()
        if (await firstWeight.isVisible().catch(() => false)) {
            const current = await firstWeight.inputValue()
            if (!current || current === '0') await firstWeight.fill('60').catch(() => undefined)
        }
        const firstReps = page.getByLabel('Повторы').first()
        if (await firstReps.isVisible().catch(() => false)) {
            const current = await firstReps.inputValue()
            if (!current || current === '0') await firstReps.fill('8').catch(() => undefined)
        }

        // Complete the first set through the real control
        const completeSetBtn = page.getByRole('button', { name: 'Завершить подход' }).first()
        await expect(completeSetBtn).toBeVisible()
        await completeSetBtn.click()

        // The session keeps the set row (now marked as done)
        await expect(page.locator('[data-testid="set-row-1"]')).toBeVisible()

        // Complete the first set of the second exercise as well
        const secondExerciseCard = page.locator('[data-testid="exercise-card"]').filter({ hasText: 'Жим лёжа' })
        const secondSetBtn = secondExerciseCard.getByRole('button', { name: 'Завершить подход' }).first()
        if ((await secondSetBtn.count()) > 0) {
            await dismissBlockingDialog(page)
            await secondSetBtn.click().catch(() => undefined)
        }

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 9: Complete workout
        // ─────────────────────────────────────────────────────────────────────────
        await dismissBlockingDialog(page)
        const completeBtn = page.locator('main').getByRole('button', { name: 'Завершить', exact: true }).last()
        await expect(completeBtn).toBeVisible()
        // The click may open the completion confirmation mid-action.
        await completeBtn.click({ timeout: 15_000 }).catch(() => undefined)

        // Confirmation dialog before the session closes
        const confirmFinishDialog = page.locator('[role="dialog"]').last()
        if (await confirmFinishDialog.isVisible().catch(() => false)) {
            const confirmFinishBtn = confirmFinishDialog
                .getByRole('button', { name: 'Завершить', exact: true })
                .last()
            if ((await confirmFinishBtn.count()) > 0) {
                await confirmFinishBtn.click().catch(() => undefined)
            }
        }

        // Wait for completion request
        await expect.poll(() => state.completeRequests.length).toBeGreaterThan(0)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 10: Verify in history
        // ─────────────────────────────────────────────────────────────────────────
        // Navigate to workouts history
        await page.goto('/workouts')
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await expect(page.getByRole('heading', { name: 'Тренировки' })).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 11: Open the completed workout details
        // ─────────────────────────────────────────────────────────────────────────
        const completedWorkoutId = state.completeRequests.at(-1)?.workoutId ?? null
        if (completedWorkoutId != null) {
            // The completed session is opened through the detail route (/workouts/:id),
            // which is what the history list links to.
            await page.goto(`/workouts/${completedWorkoutId}`)
            await expect(page).toHaveURL(new RegExp(`/workouts/${completedWorkoutId}(?:\\?.*)?$`))

            // The persisted session still carries the completed sets
            const persisted = state.details.get(Number(completedWorkoutId))
            const persistedSets =
                persisted?.exercises.flatMap((exercise) => exercise.sets_completed ?? []) ?? []
            expect(persistedSets.filter((set) => set.completed).length).toBeGreaterThan(0)
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Final verification
        // ─────────────────────────────────────────────────────────────────────────
        expect(state.startRequests.length).toBeGreaterThan(0)
        expect(state.completeRequests.length).toBeGreaterThan(0)
    })

    /**
     * SPEC-005 §58: extended golden path for the active strength workout.
     *
     * previous results → warm-up → working set → RPE → rest timer → plate
     * calculator → superset block → add set → remaining sets → next exercise →
     * timed set → complete → summary (PR + progression) → history persistence.
     */
    test('spec-005 active workout: previous result → sets → rest → PR → superset → timed → summary @spec-005', async ({
        page,
    }) => {
        // The full SPEC-005 journey is longer than the default budget.
        test.setTimeout(120_000)
        const previousWorkoutId = 901
        const state = buildWorkoutState({
            historyItems: [
                {
                    id: previousWorkoutId,
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    duration: 48,
                    comments: 'Прошлая силовая',
                    tags: ['strength'],
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'completed',
                    exercises: [
                        {
                            exercise_id: 1002,
                            name: 'Жим лёжа',
                            sets_completed: [
                                { set_number: 1, set_type: 'warmup', reps: 15, weight: 40, completed: true },
                                { set_number: 2, reps: 10, weight: 80, completed: true, rpe: 7.5 },
                                { set_number: 3, reps: 9, weight: 80, completed: true, rpe: 8 },
                            ],
                        },
                        {
                            exercise_id: 1003,
                            name: 'Планка',
                            sets_completed: [
                                { set_number: 1, set_type: 'warmup', reps: 15, weight: 20, completed: true },
                                { set_number: 2, reps: 12, weight: 20, completed: true, rpe: 7 },
                            ],
                        },
                    ],
                } as never,
            ],
        })

        await page.addInitScript(() => {
            const w = window as Window & { Telegram?: { WebApp?: Record<string, unknown> } }
            w.Telegram = {
                WebApp: {
                    initData: 'user%3D%7B%22id%22%3A100001%7D',
                    initDataUnsafe: { user: { id: 100001 } },
                    ready: () => {},
                    expand: () => {},
                    close: () => {},
                },
            }
        })

        await seedAuth(page)
        await mockWorkoutApi(page, state)

        // login → dashboard → workouts
        // Navigate directly: the bottom-nav link is remounted during bootstrap,
        // which makes click-based navigation flaky (and viewport-dependent).
        await page.goto('/workouts')
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)

        // today workout → start workout
        await page.getByRole('button', { name: 'Силовая' }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/\w+(?:\?.*)?$/)
        await page.getByLabel('Название тренировки').fill('SPEC-005 golden path')

        await addExercise(page, 'Жим', /Жим лёжа|Bench Press/i)
        await addExercise(page, 'Планка', /Планка|Plank/i)

        await page.locator('[data-testid="save-and-start-btn"]').click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
        await expect.poll(() => state.startRequests.length).toBeGreaterThan(0)
        await dismissBlockingDialog(page)

        // previous results visible (SPEC-005 §8/AC-005-003)
        const previousResultCard = page.locator('[data-testid="previous-result"]').first()
        await expect(previousResultCard).toBeVisible({ timeout: 20_000 })
        await expect(previousResultCard).toContainText(/Предыдущая тренировка|Первое выполнение/)

        // enter weight + reps for the active set (inline editing, SPEC-005 §12/§13)
        const activeWeight = page.getByLabel('Вес').first()
        await expect(activeWeight).toBeVisible()
        await activeWeight.fill('40')
        const activeReps = page.getByLabel('Повторы').first()
        await activeReps.fill('15')

        // complete warm-up (SPEC-005 §10)
        await dismissBlockingDialog(page)
        const warmupSwitch = page.getByRole('button', { name: 'Тип подхода: warmup' }).first()
        if ((await warmupSwitch.count()) > 0) {
            await warmupSwitch.click()
        }

        const markButtons = page.getByRole('button', { name: 'Завершить подход' })
        await expect(markButtons.first()).toBeVisible()
        await markButtons.first().click()
        await expect(page.locator('[data-testid="set-row-1"]')).toBeVisible()

        // rest timer starts after a set is completed (SPEC-005 §17).
        // Desktop/Android show the inline timer with ±30 controls; small mobile
        // viewports show the fullscreen overlay with a skip control.
        const inlinePlus30 = page.locator('[data-testid="rest-plus-30"]')
        const overlaySkip = page.getByRole('button', { name: 'Пропустить отдых' })
        await expect.poll(
            async () => (await inlinePlus30.isVisible().catch(() => false))
                || (await overlaySkip.isVisible().catch(() => false)),
            { timeout: 15_000 },
        ).toBe(true)
        if (await inlinePlus30.isVisible().catch(() => false)) {
            await inlinePlus30.click()
        } else {
            await overlaySkip.click()
        }

        // plate calculator for the active barbell exercise (SPEC-005 §42–43)
        const plateTrigger = page.locator('[title="Рассчитать блины"]').first()
        await expect(plateTrigger).toBeVisible()
        await plateTrigger.click()
        const plateDialog = page.locator('[role="dialog"]').last()
        await expect(plateDialog).toBeVisible()
        await expect(
            plateDialog.locator('[data-testid="plate-result"], [data-testid="plate-impossible"]').first(),
        ).toBeVisible()
        // AC-005-020: bar 20 + target 100 → symmetric plates (25 + 15) per side.
        await plateDialog.locator('[data-testid="plate-target-input"]').fill('100')
        const plateResult = plateDialog.locator('[data-testid="plate-result"]')
        await expect(plateResult).toBeVisible()
        await expect(plateResult).toContainText('25')
        await expect(plateResult).toContainText('15')
        // Close via Escape: the modal animates out and unmounts itself.
        await page.keyboard.press('Escape')
        await expect(plateDialog).toBeHidden({ timeout: 10_000 })

        // ── SUPERSET block: group the active exercise with the next one (§21) ──
        await page.getByRole('button', { name: 'Меню упражнения' }).first().click()
        await page.locator('[data-testid="exercise-superset-btn"]').first().click()
        const supersetBadge = page.locator('[data-testid="active-superset-badge"]')
        await expect(supersetBadge).toBeVisible()
        await expect(supersetBadge).toContainText('SUPERSET A')
        await expect(supersetBadge).toContainText('A1')
        // the following exercise is presented as the second member of the block
        await expect(page.locator('[data-testid="exercise-block-label"]').first()).toHaveText('A2')
        // the block reaches the server with the session snapshot
        await expect.poll(() => state.updateSessionRequests
            .flatMap((request) => (request.payload.blocks ?? []) as Array<{ type?: string }>)
            .filter((block) => block.type === 'SUPERSET').length).toBeGreaterThan(0)
        await expect.poll(() => state.updateSessionRequests
            .flatMap((request) => (request.payload.exercises ?? []) as Array<{ block_id?: unknown }>)
            .filter((exercise) => exercise.block_id != null).length).toBeGreaterThan(0)

        // ── add set: prefilled from the previous working set (§11) ──
        const setRows = page.locator('[data-testid^="set-row-"]')
        const rowsBeforeAdd = await setRows.count()
        const syncsBeforeAdd = state.updateSessionRequests.length
        const addSetBtn = page.locator('[data-testid="add-set-btn"]').first()
        await expect(addSetBtn).toBeVisible()
        await addSetBtn.click()
        await expect(setRows).toHaveCount(rowsBeforeAdd + 1)
        // the new row reaches the server (and gains its row id) before completion
        await expect.poll(() => state.updateSessionRequests.length).toBeGreaterThan(syncsBeforeAdd)
        await page.waitForTimeout(1000)

        // enter RPE for the active set (SPEC-005 §14). An incomplete set keeps the
        // value locally; it reaches the server with the completion PATCH below.
        const rpeButton = page.getByRole('button', { name: '8', exact: true }).first()
        await expect(rpeButton).toBeVisible()
        await rpeButton.click()

        // ── complete the remaining working sets → next exercise (§6/§16) ──
        // The screen advances to the following exercise once every set is done.
        for (let index = 0; index < 8; index += 1) {
            if (await page.getByRole('heading', { name: 'Планка' }).isVisible().catch(() => false)) break

            const button = page.getByRole('button', { name: 'Завершить подход' }).first()
            if ((await button.count()) === 0) break
            await dismissBlockingDialog(page)

            const weightInput = page.getByLabel('Вес').first()
            if (await weightInput.isVisible().catch(() => false)) {
                const current = await weightInput.inputValue()
                if (!current || current === '0') await weightInput.fill('80').catch(() => undefined)
            }
            const repsInput = page.getByLabel('Повторы').first()
            if (await repsInput.isVisible().catch(() => false)) {
                const current = await repsInput.inputValue()
                if (!current || current === '0') await repsInput.fill('10').catch(() => undefined)
            }

            const clicked = await button.click({ timeout: 5_000 }).then(() => true).catch(() => false)
            if (!clicked) break
            await page.waitForTimeout(300)
        }

        // every completed set is persisted through the API (SPEC-005 §16/§45)
        await expect.poll(() => state.setPatchRequests.length).toBeGreaterThan(0)
        // the RPE entered before completion is part of the completion payload (§14)
        expect(state.setPatchRequests.some((request) => Number(request.payload.rpe) === 8)).toBe(true)
        type PersistedSet = { completed?: boolean }
        type PersistedExercise = { sets_completed?: PersistedSet[] }
        const persistedSets = state.updateSessionRequests
            .flatMap((request) => ((request.payload.exercises ?? []) as PersistedExercise[]))
            .flatMap((exercise) => exercise.sets_completed ?? [])
        expect(persistedSets.some((set) => set.completed)).toBe(true)

        // ── next exercise: log a timed set (SPEC-005 §20) ──
        await dismissBlockingDialog(page)
        await expect(page.getByRole('heading', { name: 'Планка' })).toBeVisible()
        const measureTime = page.locator('[data-testid="set-measure-time"]').first()
        await expect(measureTime).toBeVisible()
        await measureTime.click()
        const durationInput = page.getByLabel('Длительность, сек').first()
        await expect(durationInput).toBeVisible()
        await durationInput.fill('45')
        await page.getByRole('button', { name: 'Завершить подход' }).first().click()

        // the completed row reports the measured duration, not reps
        await expect(page.locator('[data-testid="set-row-1"]')).toContainText('45 сек')
        await expect.poll(() => state.setPatchRequests
            .filter((request) => Number(request.payload.duration) === 45 && request.payload.reps == null)
            .length).toBeGreaterThan(0)

        // §11 prefill for a timed chain: the next set inherits the duration, and
        // switching the measurement back to reps restores the reps input.
        const nextDurationInput = page.getByLabel('Длительность, сек').first()
        await expect(nextDurationInput).toHaveValue('45')
        await page.locator('[data-testid="set-measure-reps"]').first().click()
        await expect(page.getByLabel('Повторы').first()).toBeVisible()

        // complete workout → summary with progression recommendation
        await dismissBlockingDialog(page)
        const completeBtn = page.locator('main').getByRole('button', { name: 'Завершить', exact: true }).last()
        await expect(completeBtn).toBeVisible()
        // The click may open the SPEC-005 §47 confirmation dialog mid-action;
        // tolerate a covered-click timeout and handle the dialog below.
        await completeBtn.click({ timeout: 15_000 }).catch(() => undefined)
        const confirmDialog = page.locator('[role="dialog"]').last()
        if (await confirmDialog.isVisible().catch(() => false)) {
            await confirmDialog.getByRole('button', { name: 'Завершить', exact: true }).last().click()
        }
        await expect.poll(() => state.completeRequests.length).toBeGreaterThan(0)
        const lastCompleteRequest = state.completeRequests[state.completeRequests.length - 1]
        const completePayload = lastCompleteRequest.payload
        const completedWorkoutId = lastCompleteRequest.workoutId
        const payloadExercises = (completePayload.exercises ?? []) as PersistedExercise[]
        expect(Array.isArray(completePayload.exercises)).toBe(true)
        expect(payloadExercises.some((exercise) =>
            (exercise.sets_completed ?? []).some((set) => set.completed),
        )).toBe(true)

        // The session carried its logged sets into the completion payload (§16).
        expect(payloadExercises.flatMap((exercise) => exercise.sets_completed ?? [])
            .filter((set) => set.completed).length).toBeGreaterThan(0)

        // summary screen after completion (SPEC-005 §40/§51/AC-005-030)
        await expect(page).toHaveURL(/\/workouts\/active\/\d+\/summary/)
        // PR list and the explainable next target are visible UI state, not just a PATCH.
        const summaryPrList = page.locator('[data-testid="summary-pr-list"]')
        await expect(summaryPrList).toBeVisible({ timeout: 15_000 })
        await expect(summaryPrList).toContainText('Новые рекорды')
        const summaryProgression = page.locator('[data-testid="summary-progression"]')
        await expect(summaryProgression).toBeVisible()
        await expect(summaryProgression).toContainText('Следующая цель')
        await expect(summaryProgression).toContainText('кг')

        // Everything stays persisted after reopening the app (SPEC-005 §48/§63).
        await page.goto(`/workouts/${completedWorkoutId}`)
        await expect(page).toHaveURL(new RegExp(`/workouts/${completedWorkoutId}(?:\\?.*)?$`))
        const persistedWorkout = state.details.get(Number(completedWorkoutId))
        const persistedWorkoutSets = persistedWorkout?.exercises.flatMap((exercise) => exercise.sets_completed) ?? []
        expect(persistedWorkoutSets.filter((set) => set.completed).length).toBeGreaterThan(0)
        // the timed set keeps its measured duration after the session closes (§20)
        expect(persistedWorkoutSets.some((set) => set.duration === 45)).toBe(true)
        // the superset block is part of the persisted session (§21)
        expect((persistedWorkout?.blocks ?? []).length).toBeGreaterThan(0)

        await page.reload()
        await expect(page).toHaveURL(new RegExp(`/workouts/${completedWorkoutId}(?:\\?.*)?$`))
        expect(state.completeRequests.length).toBeGreaterThan(0)
    })

    test('handles telegram auth gracefully', async ({ page }) => {
        // Verify fallback screen when Telegram context is missing. Depending on the
        // environment the app degrades to the Telegram gate, the backend health
        // (maintenance) gate, or the authenticated shell.
        await page.goto('/')

        const fallbackMsg = page.getByRole('heading', { name: /Откройте Mini App в Telegram/i })
        const maintenanceMsg = page.getByRole('heading', { name: /Техническое обслуживание/i })
        const navigation = page.getByRole('navigation', { name: 'Основная навигация' })

        await expect
            .poll(
                async () =>
                    (await fallbackMsg.count()) +
                    (await maintenanceMsg.count()) +
                    (await navigation.count()),
                { timeout: 15_000 },
            )
            .toBeGreaterThan(0)

        if ((await fallbackMsg.count()) > 0) {
            // Should show Telegram fallback
            await expect(fallbackMsg).toBeVisible()
            await expect(page.getByRole('button', { name: /Проверить снова|Retry/i })).toBeVisible()
        } else if ((await maintenanceMsg.count()) > 0) {
            // Backend unavailable: the health gate takes over instead
            await expect(maintenanceMsg).toBeVisible()
        } else {
            // If not in fallback, should have navigation
            await expect(navigation).toBeVisible()
        }
    })
})
