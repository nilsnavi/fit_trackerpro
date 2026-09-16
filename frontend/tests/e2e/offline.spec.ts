import { expect, test } from '@playwright/test'

import { installTelegramMiniAppMock } from '../helpers/telegramMock'
import { offlineFlowUser, scopeUserForPlaywrightWorker } from '../helpers/testUser'

test.describe('@mvp-e2e offline sync (реальный API)', () => {
    test.describe.configure({ timeout: 120_000 })

    test('офлайн: подход в очереди → онлайн → синхронизация', async ({ page, context }, testInfo) => {
        const user = scopeUserForPlaywrightWorker(offlineFlowUser, testInfo.workerIndex)
        await installTelegramMiniAppMock(page, { user })

        await page.goto('/')
        const onboardingTitle = page.getByRole('heading', { name: 'Добро пожаловать в FitTracker Pro' })
        // Дашборд скрывает shell-навигацию — ждём его контент, а не nav.
        await expect(onboardingTitle.or(page.getByRole('heading', { name: 'Мои шаблоны' })).first()).toBeVisible({
            timeout: 60_000,
        })

        if (await onboardingTitle.isVisible().catch(() => false)) {
            await page.getByLabel('Сила').check()
            await page.getByLabel('Начинающий').check()
            await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
            await expect(onboardingTitle).toBeHidden({ timeout: 30_000 })
        }

        await page.goto('/workouts/templates/new')
        const workoutTitle = `E2E Offline ${Date.now()}`
        await page.getByPlaceholder('Название шаблона…').fill(workoutTitle)
        // Тип — чип с реальным лейблом фильтра; затем карточка блока «Силовая»
        // открывает модалку «Выберите упражнение» с поиском.
        await page.getByRole('button', { name: 'Силовая', exact: true }).first().click()
        await page.getByRole('button', { name: 'Силовая', exact: true }).nth(1).click()
        // Справочник упражнений на реальном бэке русскоязычный.
        await page.getByPlaceholder('Поиск упражнений…').fill('Жим')
        await page.getByRole('button', { name: /Жим штанги лежа/i }).first().click()
        await expect(page.getByRole('heading', { name: 'Настроить упражнение' })).toBeVisible()
        await page.getByRole('button', { name: 'Добавить в тренировку' }).click()
        await page.getByRole('button', { name: 'Сохранить шаблон' }).click()
        await expect(page).toHaveURL(/\/workouts\/templates\/?$/, { timeout: 30_000 })

        const card = page.locator('.rounded-2xl').filter({ hasText: workoutTitle }).first()
        await card.getByRole('button', { name: 'Начать по шаблону' }).click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 30_000 })

        // Активный подход сразу открыт для ввода (inline-режим первого подхода).
        await expect(page.getByRole('button', { name: 'Завершить подход' }).first()).toBeVisible({
            timeout: 30_000,
        })

        await context.setOffline(true)
        await page.getByLabel('Вес').first().fill('40')
        await page.getByLabel('Повторы').first().fill('10')
        await page.getByRole('button', { name: 'Завершить подход' }).first().click()

        // Офлайн-баннер — единственный статус синка на активном экране (role=status).
        const syncBanner = page.getByRole('status')
        await expect(syncBanner.filter({ hasText: 'Нет соединения' })).toBeVisible({ timeout: 20_000 })

        // После рекаоннекта очередь должна уйти на сервер.
        const sessionPatch = page.waitForResponse(
            (response) =>
                /\/workouts\/history\/\d+/.test(response.url()) &&
                response.request().method() === 'PATCH' &&
                response.ok(),
            { timeout: 45_000 },
        )
        await context.setOffline(false)
        await sessionPatch
        await expect(syncBanner.filter({ hasText: 'Нет соединения' })).toBeHidden({ timeout: 30_000 })
    })
})
