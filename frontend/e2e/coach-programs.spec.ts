import { expect, test } from '@playwright/test'
import { setupTelegramWebApp } from './helpers/telegram-mock'

test('coach assigns a template based program and client starts it in Active Workout', async ({ page }) => {
    await setupTelegramWebApp(page)
    let authToken = 'coach-program-coach'
    let programStatus: 'DRAFT' | 'ACTIVE' = 'DRAFT'
    let assigned = false
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    let assignmentStartDate: string | null = futureDate
    const now = new Date().toISOString()
    const program = () => ({
        id: 31, coach_id: 10, name: 'Sprint 10.2 strength plan', description: 'Two day starter plan',
        status: programStatus, version: 1,
        days: [{ id: 71, day_number: 1, name: 'Full body', workout_template_id: 41,
            workout_template_name: 'Existing strength template', template_version: 1,
            notes: 'Keep good form', position: 0 }],
        created_at: now, updated_at: now,
    })
    const assignment = () => ({
        id: 61, coach_id: 10, client_id: 22, relationship_id: 51, program_id: 31,
        program_version: 1, status: 'ACTIVE', start_date: assignmentStartDate, end_date: null,
        coach_message: 'Let me know how it feels', client_message: null,
        paused_at: null, completed_at: null, cancelled_at: null, coach_name: 'Coach One',
        program: program(), created_at: now, updated_at: now,
    })
    const json = (route: import('@playwright/test').Route, status: number, body: unknown) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    await page.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname
        const method = request.method()
        if (path.endsWith('/health/ready')) return json(route, 200, { status: 'ready', dependencies: {} })
        if (!path.startsWith('/api/v1/')) return route.fallback()
        if (path.endsWith('/users/auth/telegram')) return json(route, 200, {
            success: true, message: 'ok', access_token: authToken, refresh_token: null,
            is_new_user: false, onboarding_required: false,
        })
        if (path.endsWith('/users/auth/me')) {
            const isClient = authToken === 'coach-program-client'
            return json(route, 200, {
                id: isClient ? 22 : 10, telegram_id: isClient ? 220 : 100,
                first_name: isClient ? 'Client Two' : 'Coach One',
                profile: { onboarding_completed: true },
                settings: { theme: 'telegram', notifications: true, units: 'metric' },
                created_at: now, updated_at: now,
            })
        }
        if (path === '/api/v1/coach/subscription' && method === 'GET') return json(route, 200, {
            plan: 'TRAINER_PRO', active_clients: { used: 0, limit: 4, remaining: 4 },
        })
        if (path.endsWith('/coach/profile')) return json(route, 200, {
            id: 1, user_id: 10, display_name: 'Coach One', bio: null, specializations: [],
            avatar_url: null, timezone: 'UTC', public_slug: null, is_active: true,
            created_at: now, updated_at: now,
        })
        if (path.endsWith('/workouts/templates')) return json(route, 200, {
            items: [{ id: 41, user_id: 10, name: 'Existing strength template', type: 'strength',
                version: 1, is_public: false, exercises: [], created_at: now, updated_at: now }],
            total: 1, page: 1, page_size: 50,
        })
        if (path === '/api/v1/coach/programs' && method === 'GET') return json(route, 200, [program()])
        if (path === '/api/v1/coach/programs' && method === 'POST') return json(route, 201, program())
        if (path === '/api/v1/coach/programs/31' && method === 'GET') return json(route, 200, program())
        if (path === '/api/v1/coach/programs/31/activate' && method === 'POST') {
            programStatus = 'ACTIVE'
            return json(route, 200, program())
        }
        if (path === '/api/v1/coach/programs/31/assignments' && method === 'GET') return json(route, 200, assigned ? [assignment()] : [])
        if (path === '/api/v1/coach/clients' && method === 'GET') return json(route, 200, [{
            client_id: 22, status: 'ACTIVE', permissions: {}, started_at: now, ended_at: null,
            archived_at: null, created_at: now, updated_at: now,
        }])
        if (path === '/api/v1/coach/programs/31/assignments' && method === 'POST') {
            assigned = true
            return json(route, 201, assignment())
        }
        if (path === '/api/v1/client/coach-programs' && method === 'GET') return json(route, 200, assigned ? [assignment()] : [])
        if (path === '/api/v1/client/coach-programs/61/days/71/start' && method === 'POST') {
            expect(request.headers()['idempotency-key']).toBeTruthy()
            return json(route, 200, {
                assignment_id: 61, program_id: 31, program_version: 1, program_day_id: 71,
                workout_template_id: 41, workout_session_id: 501, source_type: 'coach_program',
                source_metadata: { assignment_id: 61, program_id: 31, program_version: 1,
                    program_day_id: 71, workout_template_id: 41 },
            })
        }
        if (path === '/api/v1/workouts/history/501') return json(route, 200, {
            id: 501, user_id: 22, template_id: null, source_type: 'coach_program', source_id: 61,
            date: now.slice(0, 10), duration: null, exercises: [], comments: 'Sprint 10.2 strength plan — Full body',
            tags: [], glucose_before: null, glucose_after: null, session_metrics: null, version: 1,
            created_at: now, status: 'active', started_at: now, blocks: [],
        })
        if (path === '/api/v1/workouts/history') return json(route, 200, { items: [], total: 0, page: 1, page_size: 20 })
        if (path === '/api/v1/exercises') return json(route, 200, { items: [], total: 0, page: 1, page_size: 50 })
        return json(route, 200, [])
    })
    await page.addInitScript(() => localStorage.setItem('auth_token', 'coach-program-coach'))

    await page.goto('/coach')
    await page.getByRole('link', { name: 'Программы' }).click()
    await page.getByRole('button', { name: 'Создать программу' }).click()
    await page.getByLabel('Название').first().fill('Sprint 10.2 strength plan')
    await page.getByLabel('Описание').fill('Two day starter plan')
    await page.getByLabel('WorkoutTemplate').selectOption('41')
    await page.getByLabel('Заметки').fill('Keep good form')
    await page.getByRole('button', { name: 'Сохранить программу' }).click()
    await expect(page.getByText('DRAFT · версия 1')).toBeVisible()
    await page.getByRole('button', { name: 'Активировать' }).click()
    await page.getByLabel('Клиент').first().selectOption('22')
    await page.getByRole('button', { name: 'Назначить программу' }).click()
    await expect(page.getByText('Клиент 22', { exact: true }).last()).toBeVisible()

    authToken = 'coach-program-client'
    await page.evaluate(() => localStorage.setItem('auth_token', 'coach-program-client'))
    await page.goto('/client/coach-programs')
    await expect(page.getByRole('heading', { name: 'Программа тренера' })).toBeVisible()
    await expect(page.getByText('Existing strength template')).toBeVisible()
    await expect(page.getByText(`Программа начнётся ${futureDate}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeDisabled()
    assignmentStartDate = null
    await page.reload()
    await page.getByRole('button', { name: 'Начать тренировку' }).click()
    await expect(page).toHaveURL(/\/workouts\/active\/501$/)
    await expect(page.getByRole('heading', { name: 'Активная тренировка' })).toBeVisible()
})
