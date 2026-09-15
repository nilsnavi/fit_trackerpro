import { test, expect } from './fixtures'

test('app loads and navigation works', async ({ workoutAuthPage: page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/FitTracker Pro/i)

    // The root redirects to the dashboard, which hides the shell navigation on purpose,
    // so the bottom nav is driven from a section that renders it.
    await page.goto('/exercises')

    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await expect(nav).toBeVisible()

    await nav.getByRole('link', { name: 'Тренировки' }).click()
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
})
