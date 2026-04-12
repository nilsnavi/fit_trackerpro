import { expect, test } from '@playwright/test'

import { installTelegramMiniAppMock } from '../helpers/telegramMock'
import { goldenPathUser, scopeUserForPlaywrightWorker, type TelegramMiniAppUser } from '../helpers/testUser'

/**
 * Telegram WebApp: `installTelegramMiniAppMock` перехватывает `page.route()` на загрузку
 * `telegram-web-app.js` и инжектит `window.Telegram.WebApp` через `addInitScript` с initData из
 * `TEST_TELEGRAM_INIT_DATA` (frontend/.env.test) либо с подписью под текущего тестового пользователя.
 */
function telegramUserForWorker(testInfo: { workerIndex: number }): TelegramMiniAppUser {
    const fromEnv = process.env.TEST_TELEGRAM_INIT_DATA?.trim()
    if (fromEnv) {
        return { id: 123, first_name: 'Test', username: 'u123', language_code: 'en' }
    }
    return scopeUserForPlaywrightWorker(goldenPathUser, testInfo.workerIndex)
}

test.describe('@mvp-e2e golden path (реальный API)', () => {
    test.describe.configure({ timeout: 120_000 })

    test('MVP: Telegram initData → тренировки → новая силовая → каталог → сет → завершить → история', async ({
        page,
    }, testInfo) => {
        const user = telegramUserForWorker(testInfo)
        const envInit = process.env.TEST_TELEGRAM_INIT_DATA?.trim()

        await installTelegramMiniAppMock(page, { user, initDataOverride: envInit })

        await page.goto('/')
        await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible({
            timeout: 60_000,
        })

        const onboardingTitle = page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })
        if (await onboardingTitle.isVisible().catch(() => false)) {
            await page.getByLabel('Сила').check()
            await page.getByLabel('Начинающий').check()
            await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
            await expect(onboardingTitle).toBeHidden({ timeout: 30_000 })
        }

        await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts/)

        // «Новая тренировка» в UI: быстрый старт по типу — плитка «Силовая» (не путать с подписью типа у шаблонов).
        await page.locator('button').filter({ hasText: 'Силовая' }).filter({ hasText: 'Подходы' }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/strength/)

        const workoutTitle = `E2E Golden ${Date.now()}`
        await page.getByLabel('Название тренировки').fill(workoutTitle)

        await page.getByTestId('add-exercise-btn').click()
        const sheet = page.locator('[role="dialog"]').last()
        await expect(sheet).toBeVisible()
        await sheet.getByPlaceholder('Поиск упражнения...').fill('Bench')
        await expect(sheet.getByRole('button', { name: /Bench Press/i })).toBeVisible({ timeout: 25_000 })
        await sheet.getByRole('button', { name: /Bench Press/i }).first().click()

        const configDialog = page.locator('[role="dialog"]').last()
        await expect(configDialog.getByTestId('confirm-exercise-btn')).toBeVisible({ timeout: 15_000 })
        await configDialog.getByTestId('confirm-exercise-btn').click()

        await page.getByTestId('save-and-start-btn').click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 45_000 })

        const weightInput = page.locator('[data-testid="set-weight-input"]').first()
        await weightInput.fill('62.5')
        await page.locator('label').filter({ hasText: 'Повторы' }).locator('input').first().fill('8')
        await page.locator('[data-testid="set-toggle-btn"]').first().click()

        await page.getByTestId('finish-workout-btn').click()
        await expect(page.getByRole('heading', { name: 'Завершение тренировки' })).toBeVisible()
        await page.getByTestId('confirm-finish-btn').click()

        await expect(page).toHaveURL(/\/workouts\/\d+/, { timeout: 45_000 })

        await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Тренировки' }).click()
        await expect(page.getByText(workoutTitle).first()).toBeVisible({ timeout: 25_000 })
    })
})
