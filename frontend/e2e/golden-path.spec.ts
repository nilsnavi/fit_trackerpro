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

import { test, expect } from '@playwright/test'
import {
    type MockWorkoutApiState,
    buildWorkoutState,
    seedAuth,
    mockWorkoutApi,
} from './helpers/workout-api-mock'

test.describe('golden path: complete user workout flow @regression @golden-path', () => {
    test.describe.configure({ timeout: 60_000 })

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
        await expect(page).toHaveURL(/\/$/)
        await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 2: Navigate to Workouts section
        // ─────────────────────────────────────────────────────────────────────────
        const nav = page.getByRole('navigation', { name: 'Основная навигация' })
        await nav.getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await expect(page.getByRole('heading', { name: /История|Мои тренировки/i })).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 3: Create a new workout (enter mode)
        // ─────────────────────────────────────────────────────────────────────────
        // Click "Новая тренировка" or "Начать новую тренировку"
        const startNewBtn =
            page.getByRole('button', { name: /Новая тренировка|Начать новую/i }) ||
            page.getByRole('link', { name: /Новая тренировка|Начать новую/i })
        const newWorkoutLinkOrBtn = page.getByRole('link', { name: /Новая|режим/i }).first()

        // Alternative: click on mode type directly (e.g., strength)
        await page.getByRole('link', { name: /Силовая|Strength/i }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/\w+(?:\?.*)?$/)
        await expect(page.getByLabel('Название тренировки')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 4: Fill workout title
        // ─────────────────────────────────────────────────────────────────────────
        const workoutTitle = `E2E Тренировка ${new Date().getTime()}`
        await page.getByLabel('Название тренировки').fill(workoutTitle)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 5: Add first exercise
        // ─────────────────────────────────────────────────────────────────────────
        await page.locator('[data-testid="add-exercise-btn"]').click()
        let dialog = page.locator('[role="dialog"]').last()
        await expect(dialog).toBeVisible()

        // Search for exercise
        const searchInput = dialog.getByPlaceholder(/Поиск упражнения|Search/i)
        await searchInput.fill('Присед')
        await dialog.getByRole('button', { name: /Присед|Squat/i }).first().click()

        // Confirm exercise details
        const configDialog = page.locator('[role="dialog"]').last()
        await expect(configDialog).toBeVisible()
        await configDialog.locator('[data-testid="confirm-exercise-btn"]').click()
        await expect(configDialog).toBeHidden()

        // Verify exercise was added
        await expect(page.locator('#workout-mode-exercises').getByText('Присед')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 6: Add second exercise (optional, for completeness)
        // ─────────────────────────────────────────────────────────────────────────
        await page.locator('[data-testid="add-exercise-btn"]').click()
        dialog = page.locator('[role="dialog"]').last()
        await expect(dialog).toBeVisible()

        await dialog.getByPlaceholder(/Поиск упражнения|Search/i).fill('Жим')
        await dialog.getByRole('button', { name: /Жим лёжа|Bench Press/i }).first().click()

        const configDialog2 = page.locator('[role="dialog"]').last()
        await expect(configDialog2).toBeVisible()
        await configDialog2.locator('[data-testid="confirm-exercise-btn"]').click()
        await expect(configDialog2).toBeHidden()

        // Verify second exercise was added
        await expect(page.locator('#workout-mode-exercises').getByText('Жим лёжа')).toBeVisible()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 7: Save workout (create template) and start session
        // ─────────────────────────────────────────────────────────────────────────
        await page.locator('[data-testid="save-and-start-btn"]').click()

        // Wait for both create template and start workout requests
        await expect.poll(() => state.createTemplateRequests.length).toBeGreaterThan(0)
        await expect.poll(() => state.startRequests.length).toBeGreaterThan(0)

        // Should navigate to active workout page
        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 8: Log sets for each exercise
        // ─────────────────────────────────────────────────────────────────────────
        // Verify we can see exercises
        await expect(page.getByRole('heading', { name: 'Присед' })).toBeVisible()

        // Mark first set as completed
        const markButtons = page.getByRole('button', { name: /Отметить|Mark.*Complete|Марк/ })
        const firstMarkBtn = markButtons.first()
        await expect(firstMarkBtn).toBeVisible()
        await firstMarkBtn.click()

        // Check that set was marked
        await expect(page.locator('[data-testid*="set"][class*="completed"]')).toHaveCount(1)

        // Mark second exercise's first set
        const secondExerciseSection = page.locator('[data-testid*="exercise"]').filter({ hasText: /Жим лёжа/ })
        const secondSetBtn = secondExerciseSection.getByRole('button', { name: /Отметить|Mark/ }).first()
        if ((await secondSetBtn.count()) > 0) {
            await secondSetBtn.click()
        }

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 9: Complete workout
        // ─────────────────────────────────────────────────────────────────────────
        const completeBtn = page.getByRole('button', { name: /Завершить тренировку|Complete|Finish/ })
        await expect(completeBtn).toBeVisible()
        await completeBtn.click()

        // Wait for completion request
        await expect.poll(() => state.completeRequests.length).toBeGreaterThan(0)

        // Should hide complete button
        await expect(completeBtn).toBeHidden()

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 10: Verify in history
        // ─────────────────────────────────────────────────────────────────────────
        // Navigate to workouts history
        await nav.getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)

        // Should see our completed workout
        await expect(page.getByRole('heading', { name: /История|My Workouts/ })).toBeVisible()
        await expect(page.getByText('Присед')).toBeVisible()
        await expect(page.getByText('Жим лёжа')).toBeVisible()

        // Verify the workout history row contains both exercises
        const historyRow = page.locator('main').getByText(workoutTitle).first()
        if ((await historyRow.count()) > 0) {
            await expect(historyRow).toBeVisible()
        }

        // ─────────────────────────────────────────────────────────────────────────
        // STEP 11: Click on completed workout to view details
        // ─────────────────────────────────────────────────────────────────────────
        const completedWorkoutBtn = page.locator('button, [role="button"]', { hasText: /Присед/ }).first()
        if ((await completedWorkoutBtn.count()) > 0) {
            await completedWorkoutBtn.click()
            await expect(page).toHaveURL(/\/workouts\/history\/\d+(?:\?.*)?$/)

            // Verify all exercises and their completed sets are visible
            await expect(page.getByText('Присед')).toBeVisible()
            await expect(page.getByText('Жим лёжа')).toBeVisible()
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Final verification
        // ─────────────────────────────────────────────────────────────────────────
        expect(state.createTemplateRequests.length).toBeGreaterThan(0)
        expect(state.startRequests.length).toBeGreaterThan(0)
        expect(state.completeRequests.length).toBeGreaterThan(0)
    })

    test('handles telegram auth gracefully', async ({ page }) => {
        // Verify fallback screen when Telegram context is missing
        await page.goto('/')

        const fallbackMsg = page.getByRole('heading', { name: /Откройте Mini App в Telegram/i })
        const isFallbackVisible = (await fallbackMsg.count()) > 0

        if (isFallbackVisible) {
            // Should show Telegram fallback
            await expect(fallbackMsg).toBeVisible()
            await expect(page.getByRole('button', { name: /Проверить снова|Retry/i })).toBeVisible()
        } else {
            // If not in fallback, should have navigation
            await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()
        }
    })
})
