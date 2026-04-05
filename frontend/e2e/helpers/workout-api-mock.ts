/**
 * Shared mock harness for workout E2E tests.
 *
 * Export all helpers and types so each spec can import only what it needs
 * instead of defining them inline.
 */
import type { Page } from '@playwright/test'

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

export type MockWorkoutApiState = {
    templates: WorkoutTemplate[]
    historyItems: WorkoutHistoryItem[]
    details: Map<number, WorkoutHistoryItem>
    exercises: ExerciseApiItem[]
    startRequests: Array<Record<string, unknown>>
    createTemplateRequests: Array<Record<string, unknown>>
    updateSessionRequests: Array<{ workoutId: number; payload: Record<string, unknown> }>
    completeRequests: Array<{ workoutId: number; payload: Record<string, unknown> }>
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
        nextTemplateId: 500,
        nextWorkoutId: 900,
        ...overrides,
    }
}

// ── Browser seed helpers ──────────────────────────────────────────────────────

export async function seedAuth(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'e2e-token')
    })
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

        if (method === 'GET' && (normalizedPath.endsWith('/auth/me') || normalizedPath.endsWith('/users/me'))) {
            return respond(200, buildUserProfile())
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

        if (method === 'POST' && normalizedPath.endsWith('/workouts/start')) {
            const payload = (req.postDataJSON?.() ?? {}) as Record<string, unknown>
            state.startRequests.push(payload)
            const workoutId = state.nextWorkoutId++
            const title = String(payload.name ?? 'E2E сессия')
            const detail: WorkoutHistoryItem = {
                id: workoutId,
                date: isoNow(),
                duration: undefined,
                exercises: [],
                comments: title,
                tags: typeof payload.type === 'string' ? [String(payload.type)] : [],
                created_at: isoMinutesAgo(12),
            }
            state.details.set(workoutId, detail)
            state.historyItems = [detail, ...state.historyItems.filter((item) => item.id !== workoutId)]
            return respond(200, {
                id: workoutId,
                user_id: 1,
                template_id: null,
                date: detail.date,
                start_time: detail.created_at,
                status: 'ok',
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
                exercises: Array.isArray(payload.exercises) ? payload.exercises as CompletedExercise[] : current.exercises,
                comments: typeof payload.comments === 'string' ? payload.comments : current.comments,
                tags: Array.isArray(payload.tags) ? payload.tags as string[] : current.tags,
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
            const completed: WorkoutHistoryItem = {
                ...current,
                duration: typeof payload.duration === 'number' ? payload.duration : current.duration,
                exercises: Array.isArray(payload.exercises) ? payload.exercises as CompletedExercise[] : current.exercises,
                comments: typeof payload.comments === 'string' ? payload.comments : current.comments,
                tags: Array.isArray(payload.tags) ? payload.tags as string[] : current.tags,
            }
            state.details.set(workoutId, completed)
            state.historyItems = [completed, ...state.historyItems.filter((item) => item.id !== workoutId)]
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
