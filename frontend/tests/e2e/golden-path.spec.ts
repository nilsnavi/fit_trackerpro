import { expect, test } from '@playwright/test'

import { installTelegramMiniAppMock } from '../helpers/telegramMock'
import { goldenPathUser, scopeUserForPlaywrightWorker } from '../helpers/testUser'

test.describe('@mvp-e2e golden path (реальный API)', () => {
    test.describe.configure({ timeout: 120_000 })

    test('MVP golden path: вход → онбординг → шаблон → активная тренировка → история → аналитика', async ({
        page,
    }, testInfo) => {
        const user = scopeUserForPlaywrightWorker(goldenPathUser, testInfo.workerIndex)
        await installTelegramMiniAppMock(page, { user })

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

        await page.goto('/workouts/templates/new')
        await expect(page.getByPlaceholder('Название шаблона…')).toBeVisible()

        const workoutTitle = `E2E MVP ${Date.now()}`
        await page.getByPlaceholder('Название шаблона…').fill(workoutTitle)

        await page.getByRole('button', { name: 'Силовая' }).click()
        await expect(page.getByRole('heading', { name: 'Выберите упражнение' })).toBeVisible()
        const search = page.getByPlaceholder('Поиск упражнений…')
        await search.fill('Bench')
        await expect(page.getByRole('button', { name: /Bench Press/i })).toBeVisible({ timeout: 20_000 })
        await page.getByRole('button', { name: /Bench Press/i }).first().click()

        await expect(page.getByRole('heading', { name: 'Настроить упражнение' })).toBeVisible({ timeout: 15_000 })
        await page.getByRole('button', { name: 'Добавить в тренировку' }).click()

        await page.getByRole('button', { name: 'Сохранить шаблон' }).click()
        await expect(page).toHaveURL(/\/workouts\/templates\/?$/, { timeout: 30_000 })

        const templateCard = page.locator('.rounded-2xl').filter({ hasText: workoutTitle }).first()
        await templateCard.getByRole('button', { name: 'Начать по шаблону' }).click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+/, { timeout: 30_000 })

        const weightInput = page.locator('[data-testid="set-weight-input"]').first()
        await weightInput.fill('62.5')
        await page.locator('label').filter({ hasText: 'Повторы' }).locator('input').first().fill('8')
        await page.locator('[data-testid="set-toggle-btn"]').first().click()

        await page.getByTestId('finish-workout-btn').click()
        await expect(page.getByRole('heading', { name: 'Завершение тренировки' })).toBeVisible()
        await page.getByTestId('confirm-finish-btn').click()

        await expect(page).toHaveURL(/\/workouts\/\d+/, { timeout: 45_000 })

        await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Тренировки' }).click()
        await expect(page.getByText(workoutTitle).first()).toBeVisible({ timeout: 20_000 })

        await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Прогресс' }).click()
        await expect(page.getByRole('heading', { name: 'Аналитика' })).toBeVisible({ timeout: 25_000 })
        await expect(page.getByRole('heading', { name: /\d+\s+(тренировка|тренировок)/ })).toBeVisible({ timeout: 25_000 })
    })
})
