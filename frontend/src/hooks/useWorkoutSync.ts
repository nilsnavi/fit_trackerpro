import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

export interface UseWorkoutSyncParams {
    enabled: boolean
    isOnline: boolean
    /** Периодический и ручной сброс дебаунса синхронизации сессии */
    flushWorkoutSync: () => Promise<void>
    /** Отправка одного элемента из очереди (последовательно при восстановлении сети) */
    sendSessionPatch: (payload: WorkoutSessionUpdateRequest) => Promise<void>
}

export interface UseWorkoutSyncResult {
    /** Очередь неотправленных патчей сессии (в памяти) */
    pendingSync: WorkoutSessionUpdateRequest[]
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
    flushWorkoutSync,
    sendSessionPatch,
}: UseWorkoutSyncParams): UseWorkoutSyncResult {
    const queueRef = useRef<WorkoutSessionUpdateRequest[]>([])
    const [pendingSync, setPendingSync] = useState<WorkoutSessionUpdateRequest[]>([])
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

    const notifySetCompleted = useCallback(() => {
        if (!enabled) return
        void flushWorkoutSync()
    }, [enabled, flushWorkoutSync])

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
        pushPendingSync,
        clearPendingSync,
        notifySetCompleted,
    }
}
