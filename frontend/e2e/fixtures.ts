/**
 * Playwright Fixtures for E2E Tests
 *
 * Provides reusable fixtures for:
 * - Authentication (Telegram, password, token-based)
 * - Workout API mocking
 * - Common test data and helpers
 */

import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { buildWorkoutState, seedAuth, mockWorkoutApi, type MockWorkoutApiState } from './helpers/workout-api-mock'
import { setupTelegramWebApp } from './helpers/telegram-mock'

export type TestFixtures = {
    // Pre-authenticated page with Telegram WebApp mock
    authenticatedPage: Page

    // Page with workout API mocking enabled
    workoutPage: Page

    // Workout state tracker for assertions
    workoutState: MockWorkoutApiState

    // Page with both auth and workout mocking
    workoutAuthPage: Page
}

/**
 * Fixture: authenticatedPage
 * Provides a page with Telegram WebApp mock and auth token pre-seeded.
 */
export const test = base.extend<TestFixtures>({
    authenticatedPage: async ({ page }, use) => {
        // Setup Telegram WebApp context
        await setupTelegramWebApp(page)

        // Seed auth token
        await seedAuth(page)

        await use(page)
    },

    /**
     * Fixture: workoutPage
     * Provides a page with workout API mocking enabled.
     * Uses its own state that can be accessed via the workoutState fixture.
     */
    workoutPage: async ({ page }, use) => {
        const state = buildWorkoutState()

        // Mock all workout API endpoints
        await mockWorkoutApi(page, state)

        await use(page)
    },

    /**
     * Fixture: workoutState
     * Provides shared state for tracking API calls in workout tests.
     * Must be used alongside workoutPage fixture.
     */
    // Playwright: fixture без зависимостей (пустой объект параметров)
    // eslint-disable-next-line no-empty-pattern -- синтаксис Playwright для fixture без deps
    workoutState: async ({}, use) => {
        const state = buildWorkoutState()
        await use(state)
    },

    /**
     * Fixture: workoutAuthPage
     * Combined fixture with both Telegram auth and workout API mocking.
     * This is the most common setup for workout tests.
     */
    workoutAuthPage: async ({ page }, use) => {
        // Setup Telegram WebApp
        await setupTelegramWebApp(page)

        // Seed auth
        await seedAuth(page)

        // Setup workout API mocking
        const state = buildWorkoutState()
        await mockWorkoutApi(page, state)

        // Provide both page and state to test
        // Note: To access state in test, you still need to pass workoutState fixture
        await use(page)
    },
})

// Re-export expect for convenience
export { expect }
