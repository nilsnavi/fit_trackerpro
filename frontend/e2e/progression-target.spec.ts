/**
 * SPEC-006 §58 E2E golden path (mocked API):
 *
 * start workout → the active exercise shows the persisted next target with its
 * reason → "Почему?" opens the explanation sheet → accepting records the
 * decision and the card switches to the accepted target.
 *
 * The progression endpoints are mocked on top of `mockWorkoutApi`; Playwright
 * matches the most recently registered route first, so these handlers win.
 */

import { expect, test, type Page } from '@playwright/test'
import { buildWorkoutState, mockWorkoutApi, seedAuth } from './helpers/workout-api-mock'

const EXERCISE_ID = 1002
const RECOMMENDATION_ID = 4242
const STORED_RECOMMENDATION = {
    id: RECOMMENDATION_ID,
    exercise_id: EXERCISE_ID,
    policy: 'DOUBLE_PROGRESSION',
    policy_version: 'DOUBLE_PROGRESSION_V1',
    status: 'INCREASE',
    lifecycle_status: 'generated',
    previous_value: 80,
    recommended_value: 82.5,
    difference: 2.5,
    previous_reps: 12,
    recommended_reps: 12,
    reps_min: 8,
    reps_max: 12,
    reason_code: 'REP_RANGE_COMPLETED',
    reason_text: 'Все три целевых рабочих подхода достигли верхней границы 12 повторений.',
    confidence: 'high',
    source_session_id: 901,
    scope_key: 'u1:t500:te1500:e1002',
    template_id: 500,
    template_exercise_id: 1500,
    persisted: true,
}

interface ProgressionE2EState {
    acceptRequests: Array<{ recommendationId: string; body: unknown }>
    lifecycle: string
    actualSelectedValue: number | null
}

async function mockProgressionApi(page: Page, state: ProgressionE2EState) {
    const respond = (route: Parameters<Parameters<Page['route']>[1]>[0], status: number, body: unknown) =>
        route.fulfill({
            status,
            contentType: 'application/json; charset=utf-8',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(body),
        })

    // Mirrors the real API: reads return the persisted lifecycle decision.
    const currentRecommendation = () => ({
        ...STORED_RECOMMENDATION,
        lifecycle_status: state.lifecycle,
        actual_selected_value: state.actualSelectedValue,
    })

    await page.route('**/api/v1/progression/**', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname.replace(/\/+$/, '')
        const method = request.method()

        if (method === 'GET' && /\/progression\/exercises\/\d+\/history$/.test(path)) {
            return respond(route, 200, [currentRecommendation()])
        }
        if (method === 'GET' && /\/progression\/exercises\/\d+$/.test(path)) {
            return respond(route, 200, {
                id: 77,
                user_id: 1,
                exercise_id: EXERCISE_ID,
                scope_key: 'u1:e1002',
                policy_scope_key: 'u1:e1002',
                type: 'DOUBLE_PROGRESSION',
                policy_version: 'DOUBLE_PROGRESSION_V1',
                increment: 2.5,
                reps_min: 8,
                reps_max: 12,
                sets_target: 3,
                enabled: true,
            })
        }
        if (method === 'GET' && /\/progression\/exercises\/\d+\/recommendation$/.test(path)) {
            return respond(route, 200, currentRecommendation())
        }
        if (method === 'POST' && /\/progression\/recommendations\/\d+\/accept$/.test(path)) {
            const recommendationId = path.split('/').slice(-2)[0]
            const raw = request.postData()
            state.acceptRequests.push({
                recommendationId,
                body: raw ? JSON.parse(raw) : null,
            })
            state.lifecycle = 'accepted'
            state.actualSelectedValue = 82.5
            return respond(route, 200, currentRecommendation())
        }
        if (method === 'POST' && /\/progression\/recommendations\/\d+\/reject$/.test(path)) {
            state.lifecycle = 'rejected'
            return respond(route, 200, currentRecommendation())
        }
        return respond(route, 404, { detail: 'not mocked' })
    })
}

test.describe('SPEC-006 progression target @regression @spec-006', () => {
    test.describe.configure({ timeout: 90_000 })

    async function dismissBlockingDialog(page: Page) {
        const dialog = page.locator('[role="dialog"]').last()
        if (!(await dialog.isVisible().catch(() => false))) return
        await page.keyboard.press('Escape').catch(() => undefined)
        await dialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined)
    }

    test('persisted next target → "Почему?" → accept @spec-006', async ({ page }) => {
        const state = buildWorkoutState({
            historyItems: [
                {
                    id: 901,
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    duration: 48,
                    comments: 'Прошлая силовая',
                    tags: ['strength'],
                    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'completed',
                    exercises: [
                        {
                            exercise_id: EXERCISE_ID,
                            name: 'Жим лёжа',
                            sets_completed: [
                                { set_number: 1, reps: 12, weight: 80, completed: true },
                                { set_number: 2, reps: 12, weight: 80, completed: true },
                                { set_number: 3, reps: 12, weight: 80, completed: true },
                            ],
                        },
                    ],
                } as never,
            ],
        })
        const progressionState: ProgressionE2EState = {
            acceptRequests: [],
            lifecycle: 'generated',
            actualSelectedValue: null,
        }

        await seedAuth(page)
        await mockWorkoutApi(page, state)
        await mockProgressionApi(page, progressionState)

        // configure progression → start workout
        await page.goto('/workouts')
        await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)
        await page.getByRole('button', { name: 'Силовая' }).first().click()
        await expect(page).toHaveURL(/\/workouts\/mode\/\w+(?:\?.*)?$/)
        await page.getByLabel('Название тренировки').fill('SPEC-006 golden path')

        const catalogSheet = page.locator(
            '[role="dialog"]:has(input[placeholder="Поиск упражнения..."])',
        )
        await page
            .locator('#workout-mode-exercises')
            .getByRole('button', { name: /^Добавить( упражнение)?$/ })
            .first()
            .click()
        await expect(catalogSheet).toBeVisible()
        await catalogSheet.getByPlaceholder(/Поиск упражнения|Search/i).fill('Жим')
        await catalogSheet.getByRole('button', { name: /Жим лёжа|Bench Press/i }).first().click()
        const configSheet = page.locator('[role="dialog"]:has([data-testid="confirm-exercise-btn"])')
        await expect(configSheet).toBeVisible()
        await configSheet.locator('[data-testid="confirm-exercise-btn"]').click()
        await expect(configSheet).toHaveCount(0)

        await page.locator('[data-testid="save-and-start-btn"]').click()
        await expect(page).toHaveURL(/\/workouts\/active\/\d+(?:\?.*)?$/)
        await dismissBlockingDialog(page)

        // the persisted recommendation is the visible next target
        const card = page.locator('[data-testid="progression-recommendation"]').first()
        await expect(card).toBeVisible({ timeout: 20_000 })
        await expect(card).toHaveAttribute('data-status', 'INCREASE')
        await expect(card).toContainText('Следующая цель 82.5 кг')
        await expect(card).toContainText('8–12 повторов')
        await expect(card).toContainText('↑ +2.5')
        await expect(page.locator('[data-testid="progression-reason"]').first()).toContainText(
            'верхней границы 12 повторений',
        )

        // "Почему?" → explanation sheet
        await page.locator('[data-testid="progression-why"]').first().click()
        const sheet = page.locator('[data-testid="progression-why-sheet"]')
        await expect(sheet).toBeVisible()
        await expect(page.getByText('Почему 82.5 кг?')).toBeVisible()
        await expect(sheet).toContainText('REP_RANGE_COMPLETED')
        await expect(sheet).toContainText('Следующая цель: 82.5 кг × 8–12')
        await dismissBlockingDialog(page)

        // accept → decision recorded, program target only changes on explicit accept
        await page.locator('[data-testid="progression-accept"]').first().click()
        await expect.poll(() => progressionState.acceptRequests.length).toBe(1)
        expect(progressionState.acceptRequests[0].recommendationId).toBe(String(RECOMMENDATION_ID))
        await expect(page.locator('[data-testid="progression-lifecycle"]').first()).toContainText(
            'Принято',
        )
    })
})
