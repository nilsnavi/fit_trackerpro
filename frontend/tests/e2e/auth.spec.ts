import { expect, test } from '@playwright/test'

import {
    buildInvalidHashInitData,
    getE2eTelegramBotToken,
    installTelegramMiniAppMock,
} from '../helpers/telegramMock'
import {
    buildTelegramTestUser,
    returningUser,
    scopeUserForPlaywrightWorker,
    type TelegramMiniAppUser,
} from '../helpers/testUser'

test.describe('@mvp-e2e auth (реальный API)', () => {
    test('невалидный initData: ошибка, в приложение не пускает', async ({ page }, testInfo) => {
        const token = getE2eTelegramBotToken()
        const user = buildTelegramTestUser(9_888_000 + testInfo.workerIndex, 'BadInit', 'bad_init')
        const badInit = buildInvalidHashInitData(token, user)
        await installTelegramMiniAppMock(page, { user, initDataOverride: badInit })

        await page.goto('/')
        await expect(page.getByRole('heading', { name: 'Ошибка авторизации' })).toBeVisible({ timeout: 45_000 })
        await expect(page.locator('[role="alert"]').first()).toBeVisible()
    })

    test.describe.serial('повторный вход', () => {
        let user: TelegramMiniAppUser

        test('первый заход: онбординг', async ({ page }, testInfo) => {
            user = scopeUserForPlaywrightWorker(returningUser, testInfo.workerIndex)
            await installTelegramMiniAppMock(page, { user })
            await page.goto('/')

            await expect(page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })).toBeVisible({
                timeout: 60_000,
            })
            await page.getByLabel('Сила').check()
            await page.getByLabel('Начинающий').check()
            await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
            await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible({ timeout: 30_000 })
        })

        test('второй заход: онбординг пропущен', async ({ page }) => {
            await installTelegramMiniAppMock(page, { user })
            await page.goto('/')
            await expect(page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })).toBeHidden({
                timeout: 5_000,
            })
            await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible({ timeout: 30_000 })
        })
    })
})
