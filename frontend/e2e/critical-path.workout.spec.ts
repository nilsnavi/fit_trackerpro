import { test, expect } from '@playwright/test'
import { ensureLoggedIn, ensureLoggedInOptionsFromEnv } from './utils/auth'

type Json = Record<string, unknown>

function isoNow() {
    return new Date().toISOString()
}

test('critical path: login → open workout → complete → see in history', async ({ page }) => {
    await ensureLoggedIn(page, ensureLoggedInOptionsFromEnv())

    // In-memory mocked backend state.
    const templateId = 10
    const workoutId = 101
    const userId = 1

    // Mark workoutId as an active draft (WorkoutsPage template start currently doesn't set this store).
    await page.addInitScript((draft) => {
        localStorage.setItem('workout-session-draft', JSON.stringify({
            state: {
                workoutId: draft.workoutId,
                title: draft.title,
                updatedAt: Date.now(),
            },
            version: 0,
        }))
    }, { workoutId, title: 'E2E сессия' })

    const template = {
        id: templateId,
        user_id: userId,
        name: 'E2E шаблон (силовая)',
        type: 'strength',
        exercises: [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets: 1,
                reps: 5,
                rest_seconds: 90,
                weight: 60,
            },
        ],
        is_public: false,
        created_at: isoNow(),
        updated_at: isoNow(),
    }

    const startedAt = isoNow()
    const workoutDate = new Date().toISOString()
    const historyItemDraft = {
        id: workoutId,
        date: workoutDate,
        duration: undefined,
        exercises: [
            {
                exercise_id: 1001,
                name: 'Присед',
                sets_completed: [
                    {
                        set_number: 1,
                        reps: 5,
                        weight: 60,
                        completed: false,
                    },
                ],
            },
        ],
        comments: undefined,
        tags: ['strength'],
        created_at: startedAt,
    }

    let historyItems: any[] = []
    let detail: any = historyItemDraft

    await page.route('**/api/v1/**', async (route) => {
        const req = route.request()
        const url = new URL(req.url())
        const path = url.pathname
        const method = req.method()

        const corsHeaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'access-control-allow-headers': 'authorization,content-type',
        }

        const respond = (status: number, body: Json) =>
            route.fulfill({
                status,
                contentType: 'application/json; charset=utf-8',
                headers: corsHeaders,
                body: JSON.stringify(body),
            })

        // CORS preflight for cross-origin API_URL in dev.
        if (method === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: corsHeaders, body: '' })
        }

        // Templates
        if (method === 'GET' && path.endsWith('/workouts/templates')) {
            return respond(200, { items: [template], total: 1, page: 1, page_size: 50 })
        }

        // History list
        if (method === 'GET' && path.endsWith('/workouts/history')) {
            return respond(200, {
                items: historyItems,
                total: historyItems.length,
                page: 1,
                page_size: 50,
            })
        }

        // Start workout
        if (method === 'POST' && path.endsWith('/workouts/start')) {
            const startResponse = {
                id: workoutId,
                user_id: userId,
                template_id: templateId,
                date: workoutDate,
                start_time: startedAt,
                status: 'ok',
                message: 'started',
            }
            // React Query optimistic updater will also set caches; this keeps server view consistent.
            historyItems = [detail, ...historyItems]
            return respond(200, startResponse)
        }

        // Workout detail
        if (method === 'GET' && /\/workouts\/history\/\d+$/.test(path)) {
            return respond(200, detail)
        }

        // Complete workout
        if (method === 'POST' && path.endsWith('/workouts/complete')) {
            const payload = (req.postDataJSON?.() ?? {}) as any
            const completedAt = isoNow()

            detail = {
                ...detail,
                duration: payload.duration,
                exercises: payload.exercises,
                comments: payload.comments,
                tags: payload.tags ?? detail.tags,
            }

            const completeResponse = {
                id: workoutId,
                user_id: userId,
                template_id: templateId,
                date: workoutDate,
                duration: payload.duration,
                exercises: payload.exercises,
                comments: payload.comments,
                tags: payload.tags ?? [],
                glucose_before: payload.glucose_before,
                glucose_after: payload.glucose_after,
                completed_at: completedAt,
                message: 'completed',
            }

            // Replace (or insert) in list.
            historyItems = [detail, ...historyItems.filter((w) => w.id !== workoutId)]

            return respond(200, completeResponse)
        }

        // Default: allow non-API requests.
        return route.fallback()
    })

    // Ensure app is reachable post-auth.
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)

    // Open workouts.
    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    await nav.getByRole('link', { name: 'Тренировки' }).click()
    await expect(page).toHaveURL(/\/workouts(?:\?.*)?$/)

    // Open the active workout ("resume draft").
    await page.getByRole('button', { name: /Незавершённая тренировка/i }).click()
    await expect(page).toHaveURL(/\/workouts\/\d+(?:\?.*)?$/)
    await expect(page.getByRole('heading', { name: 'Детали тренировки' })).toBeVisible()

    // Mark at least one set as completed (required for completion).
    await page.getByRole('button', { name: 'Отметить' }).first().click()

    // Complete workout (save).
    await page.getByRole('button', { name: 'Завершить тренировку' }).click()
    await expect(page.getByRole('button', { name: 'Завершить тренировку' })).toBeHidden()

    // Verify it appears in history.
    await page.goto('/workouts')
    await expect(page.getByRole('main').getByRole('heading', { name: 'История' })).toBeVisible()
    await expect(page.getByText('Присед')).toBeVisible()
})

