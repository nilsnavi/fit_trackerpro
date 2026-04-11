import type { WorkoutSyncTelemetrySample } from '@app/workoutSyncTelemetryBootstrap'
import { getWorkoutSyncTelemetryBufferSnapshot } from '@app/workoutSyncTelemetryBootstrap'
import { getSyncQueueEngine } from '@shared/offline/syncQueue/engine'
import type { SyncQueueItem } from '@shared/offline/syncQueue/types'
import { resourceIdsFromSyncQueuePayload } from '@shared/offline/observability/workoutSyncTelemetry'

export type WorkoutSyncQueueDebugSummary = {
    id: string
    kind: string
    status: SyncQueueItem['status']
    attempts: number
    dedupe_key: string
    next_retry_at: number
    failed_at?: number
    /** Усечённое сообщение об ошибке, без тела ответа API. */
    last_error_preview?: string
    workout_id: number | null
    template_id: number | null
}

function previewError(msg: string | undefined, max = 100): string | undefined {
    if (!msg) return undefined
    const t = msg.replace(/\s+/g, ' ').trim()
    if (t.length <= max) return t
    return `${t.slice(0, max)}…`
}

function summarizeItem(item: SyncQueueItem): WorkoutSyncQueueDebugSummary {
    const ids = resourceIdsFromSyncQueuePayload(item.payload)
    return {
        id: item.id,
        kind: item.kind,
        status: item.status,
        attempts: item.attempts,
        dedupe_key: item.dedupeKey,
        next_retry_at: item.nextRetryAt,
        failed_at: item.failedAt,
        last_error_preview: previewError(item.lastError),
        workout_id: ids.workout_id,
        template_id: ids.template_id,
    }
}

declare global {
    interface Window {
        __FITTRACKER_SYNC_DEBUG__?: {
            getQueueSummary: () => WorkoutSyncQueueDebugSummary[]
            isFlushActive: () => boolean
            getTelemetryBuffer: () => WorkoutSyncTelemetrySample[]
        }
    }
}

/**
 * Только DEV: в консоли доступно `window.__FITTRACKER_SYNC_DEBUG__`.
 * Не вызывать из production-бандла без guard.
 */
export function installWorkoutSyncDebugHelpers(): void {
    if (typeof window === 'undefined') return
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'development') {
        return
    }

    window.__FITTRACKER_SYNC_DEBUG__ = {
        getQueueSummary: () => getSyncQueueEngine().getSnapshot().map(summarizeItem),
        isFlushActive: () => getSyncQueueEngine().isFlushActive(),
        getTelemetryBuffer: () => getWorkoutSyncTelemetryBufferSnapshot(),
    }
}
