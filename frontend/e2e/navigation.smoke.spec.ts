import { test, expect } from './fixtures'

test('app loads and navigation works', async ({ workoutAuthPage: page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/FitTracker Pro/i)

    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav).toBeVisible()

    await nav.getByRole('link', { name: 'Тренировки' }).click()
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
})
