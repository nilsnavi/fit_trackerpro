import { expect, test } from '@playwright/test'

import { installTelegramMiniAppMock } from '../helpers/telegramMock'
import { goldenPathUser, scopeUserForPlaywrightWorker, type TelegramMiniAppUser } from '../helpers/testUser'

/**
 * Telegram WebApp: `installTelegramMiniAppMock` перехватывает `page.route()` на загрузку
 * `telegram-web-app.js` и инжектит `window.Telegram.WebApp` через `addInitScript`
 * с актуальной подписью под текущего тестового пользователя.
 */
function telegramUserForWorker(testInfo: { workerIndex: number }): TelegramMiniAppUser {
    return scopeUserForPlaywrightWorker(goldenPathUser, testInfo.workerIndex)
}

test.describe('@mvp-e2e golden path (реальный API)', () => {
    test.describe.configure({ timeout: 120_000 })

    test('MVP: Telegram initData → тренировки → новая силовая → каталог → сет → завершить → история', async ({
        page,
    }, testInfo) => {
        const user = telegramUserForWorker(testInfo)

        await installTelegramMiniAppMock(page, { user })

        await page.goto('/')

        const nav = page.getByRole('navigation', { name: 'Основная навигация' })
        const onboardingTitle = page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })
        await expect(onboardingTitle.or(nav).first()).toBeVisible({ timeout: 60_000 })

        if (await onboardingTitle.isVisible().catch(() => false)) {
            await page.getByLabel('Сила').check()
            await page.getByLabel('Начинающий').check()
            await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
            await expect(onboardingTitle).toBeHidden({ timeout: 30_000 })
        }

        await expect(nav).toBeVisible({
            timeout: 60_000,
        })

        await nav.getByRole('link', { name: 'Тренировки' }).click()
        await expect(page).toHaveURL(/\/workouts/)

        // «Новая тренировка» в UI: быстрый старт по типу — плитка «Силовая» (не путать с подписью типа у шаблонов).
        await page.locator('button').filter({ hasText: 'Силовая' }).filter({ hasText: 'Подходы' }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/strength/)

        const workoutTitle = `E2E Golden ${Date.now()}`
        await page.getByLabel('Название тренировки').fill(workoutTitle)

        await page.getByTestId('add-exercise-btn').click()
        const sheet = page.locator('[role="dialog"]').last()
        await expect(sheet).toBeVisible()
        await sheet.getByPlaceholder('Поиск упражнения...').fill('Жим')
        const exerciseResult = sheet.getByRole('button', { name: /Жим штанги лежа strength/i }).first()
        await expect(exerciseResult).toBeVisible({ timeout: 25_000 })
        await exerciseResult.click()

        const configDialog = page.locator('[role="dialog"]').last()
        await expect(configDialog.getByTestId('confirm-exercise-btn')).toBeVisible({ timeout: 15_000 })
        await configDialog.getByTestId('confirm-exercise-btn').click()

        await page.getByTestId('save-and-start-btn').click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 45_000 })

        await page.getByRole('button', { name: 'Редактировать подход' }).first().click()
        await page.getByLabel('Вес').first().fill('62.5')
        await page.getByLabel('Повторы').first().fill('8')
        await page.getByRole('button', { name: 'Отметить подход 1 выполненным' }).click()

        const skipRestTimer = page.getByRole('button', { name: 'Skip' })
        if (await skipRestTimer.isVisible().catch(() => false)) {
            await skipRestTimer.click()
        }

        await page.getByRole('button', { name: 'Завершить', exact: true }).click()
        await expect(page.getByText('Завершить тренировку?')).toBeVisible()
        await page.getByRole('button', { name: 'Завершить', exact: true }).last().click()

        await expect(page).toHaveURL(/\/workouts\/active\/\d+\/summary/, { timeout: 45_000 })

        await nav.getByRole('link', { name: 'Тренировки' }).click()
        await expect(page.getByText(workoutTitle).first()).toBeVisible({ timeout: 25_000 })
    })
})
