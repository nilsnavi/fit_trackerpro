import { expect, test } from '@playwright/test'

import { installTelegramMiniAppMock } from '../helpers/telegramMock'
import { offlineFlowUser, scopeUserForPlaywrightWorker } from '../helpers/testUser'

test.describe('@mvp-e2e offline sync (реальный API)', () => {
    test.describe.configure({ timeout: 120_000 })

    test('офлайн: подход в очереди → онлайн → синхронизация', async ({ page, context }, testInfo) => {
        const user = scopeUserForPlaywrightWorker(offlineFlowUser, testInfo.workerIndex)
        await installTelegramMiniAppMock(page, { user })

        await page.goto('/')
        await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible({ timeout: 60_000 })

        const onboardingTitle = page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })
        if (await onboardingTitle.isVisible().catch(() => false)) {
            await page.getByLabel('Сила').check()
            await page.getByLabel('Начинающий').check()
            await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
            await expect(onboardingTitle).toBeHidden({ timeout: 30_000 })
        }

        const workoutTitle = `E2E Offline ${Date.now()}`
        await page.goto('/workouts/templates/new')
        await page.getByPlaceholder('Название шаблона…').fill(workoutTitle)
        await page.getByRole('button', { name: 'Силовая' }).click()
        await page.getByPlaceholder('Поиск упражнений…').fill('Bench')
        await page.getByRole('button', { name: /Bench Press/i }).first().click()
        await expect(page.getByRole('heading', { name: 'Настроить упражнение' })).toBeVisible()
        await page.getByRole('button', { name: 'Добавить в тренировку' }).click()
        await page.getByRole('button', { name: 'Сохранить шаблон' }).click()
        await expect(page).toHaveURL(/\/workouts\/templates\/?$/, { timeout: 30_000 })

        const card = page.locator('.rounded-2xl').filter({ hasText: workoutTitle }).first()
        await card.getByRole('button', { name: 'Начать по шаблону' }).click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 30_000 })

        await expect(page.getByTestId('active-workout-session-bar')).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('[data-testid="set-toggle-btn"]').first()).toBeVisible({ timeout: 20_000 })

        await context.setOffline(true)
        await page.locator('[data-testid="set-toggle-btn"]').first().evaluate((el) => (el as HTMLElement).click())

        await expect(page.getByTestId('workout-sync-indicator')).toContainText(/Офлайн|очереди/i, { timeout: 20_000 })

        await context.setOffline(false)
        await expect(page.getByTestId('workout-sync-indicator')).toContainText(/Сохранено/i, { timeout: 30_000 })
    })
})
