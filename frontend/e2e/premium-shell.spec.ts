import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'
import { buildWorkoutState, mockWorkoutApi } from './helpers/workout-api-mock'

test('premium web shell adapts its navigation and uses the existing routes', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
        localStorage.setItem('fittracker-theme', 'light')
        localStorage.setItem('auth_token', 'e2e-token')
    })
    await mockWorkoutApi(page, buildWorkoutState())
    await page.goto('/exercises')

    const shell = page.locator('[data-app-shell]')
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const catalog = nav.getByRole('link', { name: 'Каталог' })
    await expect(shell).toHaveAttribute('data-telegram', 'false')
    await expect(shell).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.getByRole('button', { name: 'Включить тёмную тему' }).click()
    await expect(shell).toHaveCSS('background-color', 'rgb(12, 16, 22)')
    await expect(catalog).toHaveAttribute('aria-current', 'page')
    await expect(nav).toHaveCSS('transition-property', 'none')
    const brand = nav.locator('.app-shell-nav-brand')

    if (testInfo.project.name === 'chromium') {
        await expect(nav).toHaveCSS('width', '248px')
        await expect(nav).toHaveCSS('top', '0px')
        await expect(brand).toBeVisible()
    } else {
        await expect(nav).toHaveCSS('bottom', '0px')
        await expect(nav).toHaveCSS('width', `${page.viewportSize()?.width}px`)
        await expect(brand).toBeHidden()
    }

    await expect(page.getByPlaceholder('Поиск упражнений...')).toBeVisible()
    const addExercise = page.getByRole('button', { name: 'Добавить упражнение', exact: true }).last()
    await addExercise.click({ trial: true })
    const actionBounds = await addExercise.boundingBox()
    const navBounds = await nav.boundingBox()
    expect(actionBounds).not.toBeNull()
    expect(navBounds).not.toBeNull()
    if (actionBounds && navBounds) {
        if (testInfo.project.name === 'chromium') {
            expect(actionBounds.x).toBeGreaterThanOrEqual(navBounds.x + navBounds.width)
        } else {
            expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(navBounds.y)
        }
    }
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.screenshot({ path: testInfo.outputPath('premium-shell.png') })
    await nav.getByRole('link', { name: 'Тренировки' }).click()
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
    await expect(nav.getByRole('link', { name: 'Тренировки' })).toHaveAttribute('aria-current', 'page')
})

for (const theme of ['light', 'dark'] as const) {
    test(`Telegram ${theme} keeps the Mini App theme and bottom navigation`, async ({ page }) => {
        await setupTelegramWebApp(page, { theme })
        await page.addInitScript(() => localStorage.setItem('auth_token', 'e2e-token'))
        await mockWorkoutApi(page, buildWorkoutState())
        await page.goto('/exercises')

        const shell = page.locator('[data-app-shell]')
        const nav = page.getByRole('navigation', { name: 'Основная навигация' })
        await expect(shell).toHaveAttribute('data-telegram', 'true')
        await expect(shell).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)')
        await expect(nav).toHaveCSS('width', `${page.viewportSize()?.width}px`)
        await expect(nav.locator('.app-shell-nav-brand')).toBeHidden()
        await expect(page.getByRole('button', { name: /Включить .* тему/ })).toHaveCount(0)
    })
}
