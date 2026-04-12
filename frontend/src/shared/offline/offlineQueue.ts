import type { WorkoutHistoryItem, WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

export const OFFLINE_WORKOUT_QUEUE_KEY = 'offline_workout_queue' as const

/** Один отложенный PATCH сессии (снимок после действия с подходом). */
export interface WorkoutSetPayload {
    workoutId: number
    body: WorkoutSessionUpdateRequest
}

export type WorkoutSetQueueApi = {
    updateWorkoutSession(workoutId: number, payload: WorkoutSessionUpdateRequest): Promise<WorkoutHistoryItem>
}

function readRawQueue(): unknown {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY)
    if (raw == null || raw === '') return null
    try {
        return JSON.parse(raw) as unknown
    } catch {
        return null
    }
}

function normalizeQueue(raw: unknown): WorkoutSetPayload[] {
    if (!Array.isArray(raw)) return []
    const out: WorkoutSetPayload[] = []
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const w = item as { workoutId?: unknown; body?: unknown }
        if (typeof w.workoutId !== 'number' || w.body == null || typeof w.body !== 'object') continue
        out.push({ workoutId: w.workoutId, body: w.body as WorkoutSessionUpdateRequest })
    }
    return out
}

function writeQueue(items: WorkoutSetPayload[]): void {
    if (typeof localStorage === 'undefined') return
    if (items.length === 0) {
        localStorage.removeItem(OFFLINE_WORKOUT_QUEUE_KEY)
        return
    }
    localStorage.setItem(OFFLINE_WORKOUT_QUEUE_KEY, JSON.stringify(items))
}

/** Добавить запись в очередь (FIFO). */
export function saveToQueue(payload: WorkoutSetPayload): void {
    const next = normalizeQueue(readRawQueue())
    next.push(payload)
    writeQueue(next)
}

export function getQueueSize(workoutId?: number): number {
    const items = normalizeQueue(readRawQueue())
    if (workoutId == null) return items.length
    return items.filter((i) => i.workoutId === workoutId).length
}

export interface FlushQueueResult {
    /** Сколько PATCH успешно ушло на сервер */
    flushed: number
    /** Ответ последнего успешного запроса (если был) */
    last: WorkoutHistoryItem | null
}

/**
 * Отправить накопленные записи по порядку и очистить соответствующие элементы из localStorage.
 * При ошибке сохраняет в хранилище только ещё не отправленные элементы и пробрасывает ошибку.
 */
export async function flushQueue(
    api: WorkoutSetQueueApi,
    options?: { workoutId?: number },
): Promise<FlushQueueResult> {
    const all = normalizeQueue(readRawQueue())
    const targetWorkoutId = options?.workoutId
    const toSend =
        targetWorkoutId != null ? all.filter((i) => i.workoutId === targetWorkoutId) : [...all]
    const toKeepLater =
        targetWorkoutId != null ? all.filter((i) => i.workoutId !== targetWorkoutId) : []

    if (toSend.length === 0) {
        return { flushed: 0, last: null }
    }

    let last: WorkoutHistoryItem | null = null
    for (let i = 0; i < toSend.length; i++) {
        const item = toSend[i]
        if (!item) continue
        try {
            last = await api.updateWorkoutSession(item.workoutId, item.body)
        } catch (e) {
            const remaining = toSend.slice(i)
            writeQueue([...toKeepLater, ...remaining])
            throw e
        }
    }

    writeQueue(toKeepLater)
    return { flushed: toSend.length, last }
}
