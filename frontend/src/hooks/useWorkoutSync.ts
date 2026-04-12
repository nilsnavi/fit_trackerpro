import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'
import { getQueueSize, saveToQueue } from '@shared/offline/offlineQueue'

export interface UseWorkoutSyncParams {
    enabled: boolean
    isOnline: boolean
    workoutId: number
    /** Текущий payload сессии для записи в offline-очередь при завершении подхода без сети */
    getSessionPayload: () => WorkoutSessionUpdateRequest | null
    /** Периодический и ручной сброс дебаунса синхронизации сессии */
    flushWorkoutSync: () => Promise<void>
    /** Отправка одного элемента из очереди (последовательно при восстановлении сети) */
    sendSessionPatch: (payload: WorkoutSessionUpdateRequest) => Promise<void>
}

export interface UseWorkoutSyncResult {
    /** Очередь неотправленных патчей сессии (в памяти) */
    pendingSync: WorkoutSessionUpdateRequest[]
    /** Количество записей в `offline_workout_queue` для этой тренировки */
    offlineSetQueueSize: number
    /** Перечитать размер из localStorage (после flush снаружи) */
    refreshOfflineSetQueueSize: () => void
    pushPendingSync: (payload: WorkoutSessionUpdateRequest) => void
    clearPendingSync: () => void
    /** После завершённого подхода */
    notifySetCompleted: () => void
}

const PERIODIC_FLUSH_MS = 30_000

/**
 * Периодическая синхронизация (30 с), триггер после подхода и очередь pendingSync в памяти.
 */
export function useWorkoutSync({
    enabled,
    isOnline,
    workoutId,
    getSessionPayload,
    flushWorkoutSync,
    sendSessionPatch,
}: UseWorkoutSyncParams): UseWorkoutSyncResult {
    const queueRef = useRef<WorkoutSessionUpdateRequest[]>([])
    const [pendingSync, setPendingSync] = useState<WorkoutSessionUpdateRequest[]>([])
    const [offlineSetQueueSize, setOfflineSetQueueSize] = useState(() => getQueueSize(workoutId))
    const drainingRef = useRef(false)
    const wasOnlineRef = useRef(isOnline)

    const syncQueueState = useCallback(() => {
        setPendingSync([...queueRef.current])
    }, [])

    const pushPendingSync = useCallback(
        (payload: WorkoutSessionUpdateRequest) => {
            queueRef.current.push(payload)
            syncQueueState()
        },
        [syncQueueState],
    )

    const clearPendingSync = useCallback(() => {
        queueRef.current = []
        syncQueueState()
    }, [syncQueueState])

    useEffect(() => {
        setOfflineSetQueueSize(getQueueSize(workoutId))
    }, [enabled, isOnline, workoutId])

    const refreshOfflineSetQueueSize = useCallback(() => {
        setOfflineSetQueueSize(getQueueSize(workoutId))
    }, [workoutId])

    const notifySetCompleted = useCallback(() => {
        if (!enabled) return
        if (!isOnline) {
            const payload = getSessionPayload()
            if (payload) {
                saveToQueue({ workoutId, body: payload })
                refreshOfflineSetQueueSize()
            }
            return
        }
        void flushWorkoutSync()
    }, [enabled, flushWorkoutSync, getSessionPayload, isOnline, refreshOfflineSetQueueSize, workoutId])

    useEffect(() => {
        if (!enabled) return
        const id = window.setInterval(() => {
            void flushWorkoutSync()
        }, PERIODIC_FLUSH_MS)
        return () => window.clearInterval(id)
    }, [enabled, flushWorkoutSync])

    const drainQueue = useCallback(async () => {
        if (!isOnline || drainingRef.current) return
        drainingRef.current = true
        try {
            while (queueRef.current.length > 0) {
                const next = queueRef.current[0]
                if (!next) break
                try {
                    await sendSessionPatch(next)
                    queueRef.current.shift()
                    syncQueueState()
                } catch {
                    break
                }
            }
        } finally {
            drainingRef.current = false
        }
    }, [isOnline, sendSessionPatch, syncQueueState])

    useEffect(() => {
        const prev = wasOnlineRef.current
        wasOnlineRef.current = isOnline
        if (!enabled) return
        if (isOnline && !prev) {
            void flushWorkoutSync()
            void drainQueue()
        }
    }, [enabled, isOnline, flushWorkoutSync, drainQueue])

    return {
        pendingSync,
        offlineSetQueueSize,
        refreshOfflineSetQueueSize,
        pushPendingSync,
        clearPendingSync,
        notifySetCompleted,
    }
}
