/**
 * Shared mock harness for workout E2E tests.
 *
 * Export all helpers and types so each spec can import only what it needs
 * instead of defining them inline.
 */
import { expect, type Page } from '@playwright/test'
import { setupTelegramWebApp } from './telegram-mock'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Json = Record<string, unknown>

export type ExerciseApiItem = {
    id: number
    name: string
    description: string | null
    category: string
    equipment: string[]
    muscle_groups: string[]
    risk_flags: {
        high_blood_pressure: boolean
        diabetes: boolean
        joint_problems: boolean
        back_problems: boolean
        heart_conditions: boolean
    }
    media_url: string | null
    status: string
    author_user_id: number | null
    created_at: string
    updated_at: string
}

export type CompletedSet = {
    set_number: number
    reps: number
    weight?: number
    completed: boolean
}

export type CompletedExercise = {
    exercise_id: number
    name: string
    sets_completed: CompletedSet[]
    notes?: string
}

export type WorkoutHistoryItem = {
    id: number
    date: string
    duration?: number
    exercises: CompletedExercise[]
    comments?: string
    tags?: string[]
    created_at: string
    glucose_before?: number
    glucose_after?: number
    /** SPEC-005 §3/§48 */
    status?: string
    started_at?: string
    blocks?: Array<Record<string, unknown>>
}

export type WorkoutTemplate = {
    id: number
    user_id: number
    name: string
    type: string
    exercises: Array<Record<string, unknown>>
    is_public: boolean
    created_at: string
    updated_at: string
}

type TemplateExercise = {
    exercise_id?: number
    name?: string
    sets?: number
    reps?: number
    weight?: number
    duration?: number
}

export type MockWorkoutApiState = {
    templates: WorkoutTemplate[]
    historyItems: WorkoutHistoryItem[]
    details: Map<number, WorkoutHistoryItem>
    exercises: ExerciseApiItem[]
    startRequests: Array<Record<string, unknown>>
    createTemplateRequests: Array<Record<string, unknown>>
    updateSessionRequests: Array<{ workoutId: number; payload: Record<string, unknown> }>
    completeRequests: Array<{ workoutId: number; payload: Record<string, unknown> }>
    // SPEC-005 request capture for the extended golden path.
    setPatchRequests: Array<{ workoutId: number; setId: number; payload: Record<string, unknown> }>
    nextTemplateId: number
    nextWorkoutId: number
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function isoNow() {
    return new Date().toISOString()
}

export function isoMinutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60_000).toISOString()
}

// ── Build helpers ─────────────────────────────────────────────────────────────

export function buildExercise(id: number, name: string, category: string = 'strength'): ExerciseApiItem {
    return {
        id,
        name,
        description: `${name} описание`,
        category,
        equipment: category === 'strength' ? ['barbell'] : ['none'],
        muscle_groups: ['legs', 'glutes'],
        risk_flags: {
            high_blood_pressure: false,
            diabetes: false,
            joint_problems: false,
            back_problems: false,
            heart_conditions: false,
        },
        media_url: null,
        status: 'approved',
        author_user_id: null,
        created_at: isoNow(),
        updated_at: isoNow(),
    }
}

export function buildUserProfile() {
    return {
        id: 1,
        telegram_id: 100001,
        username: 'e2e_user',
        first_name: 'E2E',
        last_name: 'Tester',
        profile: {
            onboarding_completed: true,
            equipment: ['barbell'],
            limitations: [],
            goals: ['strength'],
            current_weight: 82,
            target_weight: 80,
            height: 180,
        },
        settings: {
            theme: 'light',
            notifications: true,
            units: 'metric',
            language: 'ru',
        },
        created_at: isoNow(),
        updated_at: isoNow(),
    }
}

export function buildWorkoutState(overrides?: Partial<MockWorkoutApiState>): MockWorkoutApiState {
    return {
        templates: [],
        historyItems: [],
        details: new Map<number, WorkoutHistoryItem>(),
        exercises: [
            buildExercise(1001, 'Присед'),
            buildExercise(1002, 'Жим лёжа'),
            buildExercise(1003, 'Планка', 'flexibility'),
        ],
        startRequests: [],
        createTemplateRequests: [],
        updateSessionRequests: [],
        completeRequests: [],
        setPatchRequests: [],
        nextTemplateId: 500,
        nextWorkoutId: 900,
        ...overrides,
    }
}

/**
 * SPEC-005 §16: the server owns set row ids. Session updates arrive from the
 * client without ids, so the mock re-assigns deterministic ones — exactly like
 * the backend snapshot rebuild does.
 */
export function withSetIds(workoutId: number, exercises: CompletedExercise[]): CompletedExercise[] {
    return exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        sets_completed: exercise.sets_completed.map((set, setIndex) => {
            const existing = (set as { id?: number }).id
            return {
                ...set,
                id: typeof existing === 'number' ? existing : workoutId * 1000 + exerciseIndex * 10 + setIndex + 1,
            }
        }),
    }))
}

// ── Browser seed helpers ──────────────────────────────────────────────────────

/**
 * Make the app treat the visitor as a signed-in Mini App user: the Telegram WebApp
 * context that TelegramAuthGate reads, plus the token the mocked auth exchange returns.
 * Called before `page.goto`, like every other seeding helper.
 */
export async function seedAuth(page: Page) {
    await setupTelegramWebApp(page)
    await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'e2e-token')
    })
}

// ── Active workout screen ─────────────────────────────────────────────────────
// The screen renders one row per set (`set-row-N`). Only the active row carries an
// enabled "Завершить подход" control: completed rows show a check icon, locked rows a
// padlock. Specs target those controls instead of the removed numbered aria-label.

/** The control that completes whichever set is currently active. */
export function activeSetCompleteButton(page: Page) {
    return page.getByRole('button', { name: 'Завершить подход' }).first()
}

/**
 * A set cannot be completed while its weight or reps are empty or zero (SPEC-005 §13),
 * so seed plausible values first — the same thing a user does before tapping through.
 */
export async function fillActiveSetInputs(page: Page, values: { weight?: number; reps?: number } = {}) {
    const weightInput = page.getByLabel('Вес').first()
    if (await weightInput.isVisible().catch(() => false)) {
        const current = await weightInput.inputValue().catch(() => '')
        if (!current || current === '0') await weightInput.fill(String(values.weight ?? 80))
    }
    const repsInput = page.getByLabel('Повторы').first()
    if (await repsInput.isVisible().catch(() => false)) {
        const current = await repsInput.inputValue().catch(() => '')
        if (!current || current === '0') await repsInput.fill(String(values.reps ?? 10))
    }
}

/**
 * Nothing on the screen is clickable while a sheet is open. The §48 restore prompt is the
 * one that greets the app when an unfinished session exists; close it the way a user would.
 *
 * The gate that renders the prompt is loaded lazily, so it can land well after the screen has
 * painted — and it can land again after a dismissal. With an in-progress session on disk the
 * prompt is expected, so its arrival is awaited for a bounded window instead of racing it;
 * without one the call stays a single cheap check.
 */
export async function dismissBlockingDialog(page: Page) {
    const sessionInProgress = await page
        .evaluate(() => localStorage.getItem('workout-session-draft') !== null)
        .catch(() => false)
    const deadline = Date.now() + (sessionInProgress ? 8_000 : 0)

    for (;;) {
        const restorePrompt = page.getByTestId('session-restore-dialog')
        if (await restorePrompt.isVisible().catch(() => false)) {
            await page.getByTestId('restore-continue-btn').click()
            await expect(restorePrompt).toBeHidden({ timeout: 10_000 })
            return
        }

        const dialog = page.locator('[role="dialog"]').last()
        if (await dialog.isVisible().catch(() => false)) {
            // A sheet that is already animating out is still "visible" here, and an unbounded
            // click on it would retry until the test times out: the close is bounded and the
            // sheet is allowed to hide itself.
            const closeButton = dialog.getByRole('button', { name: 'Закрыть' })
            if ((await closeButton.count()) > 0) await closeButton.first().click({ timeout: 3_000 }).catch(() => undefined)
            else await page.keyboard.press('Escape').catch(() => undefined)
            await expect(dialog).toBeHidden({ timeout: 10_000 }).catch(() => undefined)
            return
        }

        if (Date.now() >= deadline) return
        await page.waitForTimeout(250)
    }
}

export async function completeActiveSet(page: Page) {
    const button = activeSetCompleteButton(page)
    await expect(button).toBeVisible({ timeout: 30_000 })

    // A sheet that appeared late can swallow the click, so dismiss and retry a couple of times.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await dismissBlockingDialog(page)
        await fillActiveSetInputs(page)
        const clicked = await button.click({ timeout: 5_000 }).then(() => true).catch(() => false)
        if (clicked) return
    }

    await fillActiveSetInputs(page)
    await button.click()
}

/** A completed set offers no "Завершить подход" control inside its row. */
export async function expectSetCompleted(page: Page, setNumber: number) {
    await expect(
        page
            .locator(`[data-testid="set-row-${setNumber}"]`)
            .getByRole('button', { name: 'Завершить подход' }),
    ).toHaveCount(0)
}

/** The active set has advanced to `setNumber`. */
export async function expectActiveSet(page: Page, setNumber: number) {
    await expect(
        page
            .locator(`[data-testid="set-row-${setNumber}"]`)
            .getByRole('button', { name: 'Завершить подход' })
            .first(),
    ).toBeVisible({ timeout: 30_000 })
}

/**
 * Finish the active workout and land on the summary step. "Завершить" may open the
 * §47 confirmation dialog mid-action, so a covered click is tolerated and the dialog is
 * confirmed when it appears.
 */
export async function finishActiveWorkout(page: Page) {
    await dismissBlockingDialog(page)
    const completeButton = page.locator('main').getByRole('button', { name: 'Завершить', exact: true }).last()
    await expect(completeButton).toBeVisible({ timeout: 30_000 })
    await completeButton.click({ timeout: 15_000 }).catch(() => undefined)

    const confirmDialog = page.locator('[role="dialog"]').last()
    if (await confirmDialog.isVisible().catch(() => false)) {
        await confirmDialog.getByRole('button', { name: 'Завершить', exact: true }).last().click()
    }

    await expect(page).toHaveURL(/\/workouts\/active\/\d+\/summary(?:\?.*)?$/, { timeout: 30_000 })
}

export async function seedDraft(page: Page, workoutId: number, title: string) {
    await page.addInitScript((draft) => {
        localStorage.setItem('workout-session-draft', JSON.stringify({
            state: {
                workoutId: draft.workoutId,
                title: draft.title,
                updatedAt: Date.now(),
            },
            version: 0,
        }))
    }, { workoutId, title })
}

// ── Route mock ────────────────────────────────────────────────────────────────

export async function mockWorkoutApi(page: Page, state: MockWorkoutApiState) {
    // Health check endpoint mock (root level, not under /api/v1/)
    await page.route('**/health/ready', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            headers: {
                'access-control-allow-origin': '*',
            },
            body: JSON.stringify({
                status: 'ready',
                timestamp: isoNow(),
                dependencies: {
                    database: { name: 'database', healthy: true },
                },
            }),
        })
    })

    await page.route('**/api/v1/**', async (route) => {
        const req = route.request()
        const url = new URL(req.url())
        const path = url.pathname
        const normalizedPath = path.replace(/\/+$/, '')
        const method = req.method()

        const corsHeaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'access-control-allow-headers': 'authorization,content-type',
        }

        const respond = (status: number, body: Json | Json[] | string = '') =>
            route.fulfill({
                status,
                contentType: typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
                headers: corsHeaders,
                body: typeof body === 'string' ? body : JSON.stringify(body),
            })

        if (method === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: corsHeaders, body: '' })
        }

        // Health check endpoint - always return ready for E2E tests
        if (method === 'GET' && (normalizedPath.endsWith('/health/ready') || normalizedPath === '/health/ready')) {
            return respond(200, {
                status: 'ready',
                timestamp: isoNow(),
                dependencies: {
                    database: { name: 'database', healthy: true },
                },
            })
        }

        if (method === 'GET' && (normalizedPath.endsWith('/auth/me') || normalizedPath.endsWith('/users/me'))) {
            return respond(200, buildUserProfile())
        }

        // Экстренные контакты: главная спрашивает список при загрузке (WS1-13).
        // Явный ответ, чтобы сценарии не зависели от «пустого» фоллбэка ниже.
        if (method === 'GET' && normalizedPath.endsWith('/system/emergency/contact')) {
            return respond(200, { items: [], total: 0, active_count: 0 })
        }

        // TelegramAuthGate exchanges the injected initData for a token; without this
        // handler the catch-all answer has no access_token and the app lands on its
        // "Ошибка авторизации" screen instead of the shell.
        if (method === 'POST' && normalizedPath.endsWith('/users/auth/telegram')) {
            return respond(200, {
                success: true,
                message: 'ok',
                access_token: 'e2e-token',
                refresh_token: 'e2e-refresh-token',
                is_new_user: false,
                onboarding_required: false,
            })
        }

        if (method === 'GET' && /\/users\/stats$/.test(normalizedPath)) {
            return respond(200, {
                active_days: 5,
                total_workouts: state.historyItems.length,
                current_streak: 2,
                longest_streak: 7,
                total_duration: 240,
                total_calories: 1800,
            })
        }

        if (method === 'GET' && /coach-access$/.test(normalizedPath)) {
            return respond(200, [])
        }

        // Health metrics for home dashboard widgets (WS2-2)
        if (method === 'GET' && (normalizedPath.includes('/health-metrics/water/goal') || normalizedPath.includes('/health-metrics/water/reminder'))) {
            return respond(200, { daily_goal: 2000, enabled: false })
        }
        if (method === 'GET' && normalizedPath.includes('/health-metrics/water/daily')) {
            return respond(200, { total: 0, goal: 2000, entries: [] })
        }
        if (method === 'GET' && normalizedPath.includes('/health-metrics/water')) {
            return respond(200, { items: [], total: 0, page: 1, page_size: 50, total_amount: 0 })
        }
        if (method === 'GET' && (normalizedPath.includes('/health-metrics/glucose') || normalizedPath.includes('/health-metrics/wellness'))) {
            return respond(200, [])
        }

        if (method === 'GET' && normalizedPath.endsWith('/exercises')) {
            return respond(200, {
                items: state.exercises,
                total: state.exercises.length,
                page: 1,
                page_size: state.exercises.length,
                filters: {},
            })
        }

        if (method === 'GET' && normalizedPath.endsWith('/workouts/templates')) {
            return respond(200, {
                items: state.templates,
                total: state.templates.length,
                page: 1,
                page_size: 50,
            })
        }

        if (method === 'POST' && normalizedPath.endsWith('/workouts/templates')) {
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.createTemplateRequests.push(payload)
            const template: WorkoutTemplate = {
                id: state.nextTemplateId++,
                user_id: 1,
                name: String(payload.name ?? 'Новый шаблон'),
                type: String(payload.type ?? 'strength'),
                exercises: Array.isArray(payload.exercises) ? payload.exercises as Array<Record<string, unknown>> : [],
                is_public: false,
                created_at: isoNow(),
                updated_at: isoNow(),
            }
            state.templates.unshift(template)
            return respond(200, template)
        }

        if (method === 'GET' && normalizedPath.endsWith('/workouts/history')) {
            return respond(200, {
                items: state.historyItems,
                total: state.historyItems.length,
                page: 1,
                page_size: 50,
            })
        }

        if (method === 'GET' && /\/workouts\/history\/\d+$/.test(normalizedPath)) {
            const workoutId = Number(normalizedPath.split('/').pop())
            const detail = state.details.get(workoutId)
            if (!detail) {
                return respond(404, { detail: 'Workout not found' })
            }
            return respond(200, detail)
        }

        // ── SPEC-005 endpoints ────────────────────────────────────────────────

        if (method === 'GET' && normalizedPath.endsWith('/workouts/sessions/incomplete')) {
            const open = state.historyItems.filter(
                (item) => item.duration == null && (item.status ?? 'active') !== 'cancelled',
            )
            return respond(200, open.map((item) => ({
                id: item.id,
                name: item.comments ?? null,
                status: item.status ?? 'active',
                date: item.date,
                elapsed_seconds: 1800,
                exercise_count: item.exercises.length,
                completed_exercise_count: item.exercises.filter((exercise) =>
                    exercise.sets_completed.some((set) => set.completed),
                ).length,
                created_at: item.created_at,
            })))
        }

        if (method === 'GET' && normalizedPath.endsWith('/workouts/progression/recommendation')) {
            const exerciseId = Number(url.searchParams.get('exercise_id') ?? 0)
            return respond(200, {
                recommended_value: 82.5,
                previous_value: 80,
                difference: 2.5,
                policy: String(url.searchParams.get('policy') ?? 'DOUBLE_PROGRESSION'),
                reason_code: 'REP_RANGE_COMPLETED',
                reason_text: 'Верхняя граница 8–12 достигнута во всех рабочих подходах — двойная прогрессия: 80 + 2.5 = 82.5 кг.',
                confidence: 'high',
                source_session_id: state.details.size > 0 ? Array.from(state.details.keys())[0] : null,
                exercise_id: exerciseId,
            })
        }

        if (method === 'POST' && /\/workouts\/\d+\/cancel$/.test(normalizedPath)) {
            const workoutId = Number(normalizedPath.split('/')[normalizedPath.split('/').length - 2])
            const current = state.details.get(workoutId)
            if (current) {
                const cancelled: WorkoutHistoryItem = { ...current, status: 'cancelled' }
                state.details.set(workoutId, cancelled)
                state.historyItems = state.historyItems.filter((item) => item.id !== workoutId)
            }
            return respond(200, {
                id: workoutId,
                status: 'cancelled',
                message: 'Workout cancelled',
            })
        }

        if (method === 'PATCH' && /\/workouts\/\d+\/sets\/\d+$/.test(normalizedPath)) {
            const segments = normalizedPath.split('/')
            const workoutId = Number(segments[segments.length - 3])
            const setId = Number(segments[segments.length - 1])
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.setPatchRequests.push({ workoutId, setId, payload })

            // The completion payload never carries set_number: the server owns the
            // mapping from the set row id. Resolve it from the stored session, exactly
            // like the backend snapshot lookup — otherwise the client would apply the
            // response to the wrong set row.
            const current = state.details.get(workoutId)
            let setNumber = Number(payload.set_number ?? 1)
            let exerciseId = Number(payload.exercise_id ?? 1)
            let exerciseName = String(payload.exercise_name ?? 'Упражнение')
            let storedSet: (CompletedSet & Record<string, unknown>) | undefined
            for (const exercise of current?.exercises ?? []) {
                for (const set of exercise.sets_completed) {
                    if ((set as { id?: number }).id !== setId) continue
                    setNumber = set.set_number
                    exerciseId = exercise.exercise_id
                    exerciseName = exercise.name
                    storedSet = set as CompletedSet & Record<string, unknown>
                }
            }

            // The mock stands in for the server, so a completed set has to survive into the
            // session the next GET returns — otherwise a reload after logging a set would
            // show the row as pending again.
            if (storedSet) {
                storedSet.completed = payload.completed !== false
                for (const field of ['reps', 'weight', 'rpe', 'duration', 'rest_seconds', 'set_type'] as const) {
                    if (payload[field] !== undefined) storedSet[field] = payload[field]
                }
            }

            return respond(200, {
                id: setId,
                workout_id: workoutId,
                exercise_id: exerciseId,
                set_number: setNumber,
                reps: payload.reps ?? null,
                weight: payload.weight ?? null,
                rpe: payload.rpe ?? null,
                // SPEC-005 §20: timed sets carry duration instead of reps.
                duration: payload.duration ?? null,
                rest_seconds: payload.rest_seconds ?? null,
                completed: payload.completed ?? true,
                notes: payload.notes ?? null,
                personal_records: payload.completed === false
                    ? null
                    : [{
                        record_type: 'MAX_WEIGHT',
                        exercise_id: exerciseId,
                        exercise_name: exerciseName,
                        value: Number(payload.weight ?? 100),
                        unit: 'kg',
                        is_new_record: true,
                        previous_value: null,
                        set_number: setNumber,
                        achieved_at: isoNow(),
                    }],
            })
        }

        if (
            method === 'POST' &&
            (normalizedPath.endsWith('/workouts/start') || normalizedPath.endsWith('/workouts/sessions'))
        ) {
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.startRequests.push(payload)
            const workoutId = state.nextWorkoutId++
            const title = String(payload.name ?? 'E2E сессия')
            // SPEC-005 §2: both the legacy /start payload and the canonical
            // /sessions payload (source_type + source_id + overrides) are mocked.
            const templateId = typeof payload.template_id === 'number'
                ? payload.template_id
                : payload.source_type === 'personal_template' && typeof payload.source_id === 'number'
                    ? payload.source_id
                    : null
            const template = templateId == null ? null : state.templates.find((item) => item.id === templateId)
            const overrides = (payload.overrides ?? {}) as { exercises?: TemplateExercise[] }
            const templateExercisesRaw = (Array.isArray(overrides.exercises) && overrides.exercises.length > 0
                ? overrides.exercises
                : template?.exercises ?? []) as TemplateExercise[]
            const exercises: CompletedExercise[] = templateExercisesRaw.map((exercise, exerciseIndex) => {
                const sets = Math.max(1, Number(exercise.sets ?? 1))
                const reps = typeof exercise.reps === 'number' ? exercise.reps : undefined
                const weight = typeof exercise.weight === 'number' ? exercise.weight : undefined
                const duration = typeof exercise.duration === 'number' ? exercise.duration : undefined

                return {
                    exercise_id: Number(exercise.exercise_id ?? exerciseIndex + 1),
                    name: String(exercise.name ?? `Упражнение ${exerciseIndex + 1}`),
                    sets_completed: Array.from({ length: sets }, (_, setIndex) => ({
                        // SPEC-005 §16: every persisted set carries its row id, which
                        // the PATCH /sets/{id} completion flow requires.
                        id: workoutId * 1000 + exerciseIndex * 10 + setIndex + 1,
                        set_number: setIndex + 1,
                        set_type: 'working',
                        completed: false,
                        reps,
                        weight,
                        duration,
                    })),
                }
            })

            const overrideTags = Array.isArray(overrides.tags) ? overrides.tags as string[] : []
            const detail: WorkoutHistoryItem = {
                id: workoutId,
                date: isoNow(),
                duration: undefined,
                exercises,
                comments: title,
                tags: overrideTags.length > 0
                    ? overrideTags
                    : typeof payload.type === 'string' ? [String(payload.type)] : [],
                created_at: isoMinutesAgo(12),
                // SPEC-005 §3/§4: lifecycle status + start timestamp.
                status: 'active',
                started_at: isoMinutesAgo(12),
            }
            state.details.set(workoutId, detail)
            state.historyItems = [detail, ...state.historyItems.filter((item) => item.id !== workoutId)]
            return respond(200, {
                id: workoutId,
                user_id: 1,
                template_id: templateId,
                date: detail.date,
                start_time: detail.created_at,
                status: 'ok',
                session_status: 'active',
                message: 'started',
            })
        }

        if (method === 'PATCH' && /\/workouts\/history\/\d+$/.test(normalizedPath)) {
            const workoutId = Number(normalizedPath.split('/').pop())
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.updateSessionRequests.push({ workoutId, payload })
            const current = state.details.get(workoutId)
            if (!current) {
                return respond(404, { detail: 'Workout not found' })
            }
            const updated: WorkoutHistoryItem = {
                ...current,
                exercises: Array.isArray(payload.exercises)
                    ? withSetIds(workoutId, payload.exercises as CompletedExercise[])
                    : current.exercises,
                comments: typeof payload.comments === 'string' ? payload.comments : current.comments,
                tags: Array.isArray(payload.tags) ? payload.tags as string[] : current.tags,
                status: typeof payload.status === 'string' ? payload.status : current.status,
                // SPEC-005 §24: session blocks (superset/triset/circuit).
                blocks: Array.isArray(payload.blocks)
                    ? (payload.blocks as Array<Record<string, unknown>>).map((block, index) => ({ id: index + 1, ...block }))
                    : current.blocks,
            }
            state.details.set(workoutId, updated)
            state.historyItems = [updated, ...state.historyItems.filter((item) => item.id !== workoutId)]
            return respond(200, updated)
        }

        if (method === 'POST' && normalizedPath.endsWith('/workouts/complete')) {
            const workoutId = Number(url.searchParams.get('workout_id'))
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.completeRequests.push({ workoutId, payload })
            const current = state.details.get(workoutId)
            if (!current) {
                return respond(404, { detail: 'Workout not found' })
            }
            // The server closes the session: it records the elapsed time and the terminal
            // status. The history list drops its "В процессе" badge on that duration.
            const startedAt = new Date(current.started_at ?? current.created_at).getTime()
            const elapsedMinutes = Number.isFinite(startedAt)
                ? Math.max(1, Math.round((Date.now() - startedAt) / 60_000))
                : 1
            const completed: WorkoutHistoryItem = {
                ...current,
                status: 'completed',
                duration: typeof payload.duration === 'number' && payload.duration > 0
                    ? payload.duration
                    : current.duration ?? elapsedMinutes,
                exercises: Array.isArray(payload.exercises)
                    ? withSetIds(workoutId, payload.exercises as CompletedExercise[])
                    : current.exercises,
                comments: typeof payload.comments === 'string' ? payload.comments : current.comments,
                tags: Array.isArray(payload.tags) ? payload.tags as string[] : current.tags,
            }
            state.details.set(workoutId, completed)
            state.historyItems = [completed, ...state.historyItems.filter((item) => item.id !== workoutId)]
            const workingSets = completed.exercises.flatMap((exercise) =>
                exercise.sets_completed.filter((set) => (set as { set_type?: string }).set_type !== 'warmup' && set.completed),
            )
            const maxWeightSet = workingSets.reduce<CompletedSet | null>((best, set) => {
                if (typeof set.weight !== 'number') return best
                if (!best || typeof best.weight !== 'number' || set.weight > best.weight) return set
                return best
            }, null)
            return respond(200, {
                id: workoutId,
                user_id: 1,
                template_id: null,
                date: completed.date,
                duration: completed.duration,
                exercises: completed.exercises,
                comments: completed.comments,
                tags: completed.tags,
                glucose_before: completed.glucose_before,
                glucose_after: completed.glucose_after,
                completed_at: isoNow(),
                // SPEC-005 §40: PRs detected during the session (warm-up excluded).
                personal_records: maxWeightSet && typeof maxWeightSet.weight === 'number'
                    ? [{
                        record_type: 'MAX_WEIGHT',
                        exercise_id: completed.exercises[0]?.exercise_id ?? 1,
                        exercise_name: completed.exercises[0]?.name ?? 'Exercise',
                        value: maxWeightSet.weight,
                        unit: 'kg',
                        is_new_record: true,
                        previous_value: null,
                        set_number: maxWeightSet.set_number,
                        achieved_at: isoNow(),
                    }]
                    : [],
                // SPEC-005 §51: explainable next targets.
                progression_recommendations: completed.exercises.map((exercise) => ({
                    exercise_id: exercise.exercise_id,
                    recommended_value: 82.5,
                    previous_value: 80,
                    difference: 2.5,
                    policy: 'DOUBLE_PROGRESSION',
                    reason_code: 'REP_RANGE_COMPLETED',
                    reason_text: 'Верхняя граница 8–12 достигнута во всех рабочих подходах.',
                    confidence: 'high',
                    source_session_id: workoutId,
                })),
                message: 'completed',
            })
        }

        // Never hit external API in tests: unknown endpoints return empty success payload.
        if (method === 'GET') {
            return respond(200, {})
        }

        return respond(204, '')
    })
}
