import * as Sentry from '@sentry/react'

import { isSentryEnabled } from '@app/sentry'
import { isAppHttpError } from '@shared/errors'

/**
 * Клиентская наблюдаемость цикла офлайн/online-синхронизации тренировок.
 * Без телеметрии по содержимому подходов, весам, комментариям и названиям.
 */

export type WorkoutSyncTelemetryEvent =
    | 'draft_initialized'
    | 'local_update_queued'
    | 'sync_started'
    | 'sync_succeeded'
    | 'sync_failed'
    | 'conflict_detected'
    | 'workout_completed_offline'
    | 'retry_succeeded'

export type WorkoutSyncTelemetryPayload = Record<
    string,
    string | number | boolean | null | undefined
>

export type WorkoutSyncTelemetrySink = (
    event: WorkoutSyncTelemetryEvent,
    payload: WorkoutSyncTelemetryPayload,
) => void

let sink: WorkoutSyncTelemetrySink | null = null

/** Для тестов или внешнего сборщика (OpenTelemetry / внутренний бэкенд). */
export function setWorkoutSyncTelemetrySink(next: WorkoutSyncTelemetrySink | null): void {
    sink = next
}

function truncateReason(raw: string, max = 160): string {
    const s = raw.trim()
    if (s.length <= max) return s
    return `${s.slice(0, max)}…`
}

function sentryBreadcrumb(
    event: WorkoutSyncTelemetryEvent,
    data: WorkoutSyncTelemetryPayload,
): void {
    if (!isSentryEnabled()) return
    const level =
        event === 'sync_failed' || event === 'conflict_detected' ? 'warning' : 'info'
    Sentry.addBreadcrumb({
        category: 'workout.sync',
        message: event,
        level,
        data: data as Record<string, unknown>,
    })
}

function logWorkoutSyncToConsole(): boolean {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
}

export function emitWorkoutSyncTelemetry(
    event: WorkoutSyncTelemetryEvent,
    payload: WorkoutSyncTelemetryPayload = {},
): void {
    const merged: WorkoutSyncTelemetryPayload = { ts: Date.now(), ...payload }
    if (logWorkoutSyncToConsole()) {
        console.debug('[workout-sync]', event, merged)
    }
    sink?.(event, { ...merged })
    sentryBreadcrumb(event, merged)
}

/** HTTP-ответы, которые трактуем как конфликт версий / состояния. */
export function isSyncConflictHttpError(error: unknown): boolean {
    if (!isAppHttpError(error)) return false
    const s = error.status
    return s === 409 || s === 412 || s === 428
}

export function syncErrorTelemetryFields(error: unknown): {
    error_class: string
    http_status: number | null
    error_code: string | null
} {
    if (isAppHttpError(error)) {
        return {
            error_class: 'AppHttpError',
            http_status: error.status,
            error_code: error.code,
        }
    }
    if (error instanceof Error) {
        return {
            error_class: error.name,
            http_status: null,
            error_code: null,
        }
    }
    return { error_class: 'unknown', http_status: null, error_code: null }
}

export type WorkoutSyncConflictSource = 'merge_util' | 'sync_queue' | 'manual'

/**
 * Конфликт синхронизации: breadcrumb + отдельное сообщение в Sentry (уровень warning).
 * Не передавайте сюда тела запросов и пользовательские строки из payload.
 */
export function notifyWorkoutSyncConflictDetected(options: {
    resource: 'workout' | 'template' | 'unknown'
    resource_id: number | null
    local_version?: number | null
    server_version?: number | null
    reason: string
    source: WorkoutSyncConflictSource
    http_status?: number | null
    queue_kind?: string | null
}): void {
    const reason = truncateReason(options.reason, 200)
    emitWorkoutSyncTelemetry('conflict_detected', {
        resource: options.resource,
        resource_id: options.resource_id ?? undefined,
        local_version: options.local_version ?? undefined,
        server_version: options.server_version ?? undefined,
        reason,
        source: options.source,
        http_status: options.http_status ?? undefined,
        queue_kind: options.queue_kind ?? undefined,
    })

    if (!isSentryEnabled()) return

    Sentry.captureMessage('workout.sync.conflict', {
        level: 'warning',
        tags: {
            'workout.sync.conflict_source': options.source,
            'workout.sync.resource': options.resource,
        },
        extra: {
            resource_id: options.resource_id,
            local_version: options.local_version,
            server_version: options.server_version,
            http_status: options.http_status,
            queue_kind: options.queue_kind,
            reason,
        },
        fingerprint: ['workout-sync-conflict', options.resource, String(options.resource_id ?? 'na')],
    })
}

/** Извлечь числовые id из payload очереди (без сериализации всего payload). */
export function resourceIdsFromSyncQueuePayload(payload: unknown): {
    workout_id: number | null
    template_id: number | null
} {
    if (!payload || typeof payload !== 'object') {
        return { workout_id: null, template_id: null }
    }
    const p = payload as Record<string, unknown>
    const workoutId =
        typeof p.workoutId === 'number'
            ? p.workoutId
            : typeof p.workout_id === 'number'
              ? p.workout_id
              : null
    const templateId =
        typeof p.templateId === 'number'
            ? p.templateId
            : typeof p.template_id === 'number'
              ? p.template_id
              : null
    if (workoutId != null || templateId != null) {
        return { workout_id: workoutId, template_id: templateId }
    }
    const body = p.body
    if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>
        const wid = typeof b.workout_id === 'number' ? b.workout_id : null
        if (wid != null) return { workout_id: wid, template_id: null }
    }
    return { workout_id: null, template_id: null }
}
