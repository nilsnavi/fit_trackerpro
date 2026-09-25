import type {
    WorkoutSyncTelemetryEvent,
    WorkoutSyncTelemetryPayload,
} from '@shared/offline/observability/workoutSyncTelemetry'
import { setWorkoutSyncTelemetrySink } from '@shared/offline/observability/workoutSyncTelemetry'

const BUFFER_CAP = 200

export type WorkoutSyncTelemetrySample = {
    event: WorkoutSyncTelemetryEvent
    payload: WorkoutSyncTelemetryPayload
    at: number
}

declare global {
    interface Window {
        __WORKOUT_SYNC_TELEMETRY_BUFFER__?: WorkoutSyncTelemetrySample[]
    }
}

function trimEnv(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const t = value.trim()
    return t === '' ? undefined : t
}

function pushToWindowBuffer(event: WorkoutSyncTelemetryEvent, payload: WorkoutSyncTelemetryPayload): void {
    if (typeof window === 'undefined') return
    const buf = (window.__WORKOUT_SYNC_TELEMETRY_BUFFER__ ??= [])
    buf.push({ event, payload: { ...payload }, at: Date.now() })
    while (buf.length > BUFFER_CAP) buf.shift()
}

/**
 * Последние события sync-телеметрии (копия буфера). Для поддержки в production.
 */
export function getWorkoutSyncTelemetryBufferSnapshot(): WorkoutSyncTelemetrySample[] {
    if (typeof window === 'undefined') return []
    const buf = window.__WORKOUT_SYNC_TELEMETRY_BUFFER__
    return buf ? [...buf] : []
}

function postToBeaconUrl(url: string, event: WorkoutSyncTelemetryEvent, payload: WorkoutSyncTelemetryPayload): void {
    const body = JSON.stringify({ event, payload })
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
            if (ok) return
        }
    } catch {
        /* fall through */
    }
    void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
    }).catch(() => {
        /* fire-and-forget */
    })
}

/**
 * Подключает sink: кольцевой буфер в `window` + опционально внешний ingest
 * (`VITE_WORKOUT_SYNC_TELEMETRY_URL`). Отдельного REST-эндпоинта на бэкенде нет:
 * прежняя ветка `VITE_WORKOUT_SYNC_TELEMETRY_API=1` слала события в несуществующий
 * `POST /client/workout-sync-events` и получала 404.
 * Вызывать один раз при старте приложения (см. `main.tsx`).
 */
export function installWorkoutSyncTelemetryInfrastructure(): void {
    const beaconUrl = trimEnv(import.meta.env.VITE_WORKOUT_SYNC_TELEMETRY_URL)

    setWorkoutSyncTelemetrySink((event, payload) => {
        pushToWindowBuffer(event, payload)

        if (beaconUrl) {
            postToBeaconUrl(beaconUrl, event, payload)
        }
    })
}
