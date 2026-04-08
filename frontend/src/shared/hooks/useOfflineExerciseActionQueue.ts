import { useCallback, useEffect, useState } from 'react'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { getSyncQueueEngine } from '@shared/offline/syncQueue'
import { toast } from '@shared/stores/toastStore'

export type ExerciseActionType = 'ADD_SET' | 'UPDATE_SET' | 'REMOVE_SET' | 'UPDATE_EXERCISE'

export interface ExerciseAction {
    id: string
    type: ExerciseActionType
    workoutId: number
    exerciseIndex: number
    setIndex?: number
    payload: unknown
    createdAt: number
    status: 'pending' | 'synced' | 'failed'
    lastError?: string
}

const OFFLINE_EXERCISE_QUEUE_KEY = 'fittracker_exercise_action_queue_v1'

/**
 * Менеджер for exercise-level actions during offline mode.
 * Tracks add set, update weight/reps, remove set operations locally.
 *
 * **Key Features:**
 * - Queue exercise actions locally during offline
 * - Optimistically apply changes to UI
 * - Sync when network returns
 * - Per-action retry with last-write-wins strategy
 * - Simple localStorage persistence
 *
 * @example
 * ```tsx
 * const queue = useOfflineExerciseActionQueue(workoutId)
 *
 * const handleAddSet = useCallback(() => {
 *   queue.enqueueAction({
 *     type: 'ADD_SET',
 *     exerciseIndex: 0,
 *     payload: { reps: 10, weight: 50 }
 *   })
 * }, [queue])
 * ```
 */
export function useOfflineExerciseActionQueue(workoutId: number) {
    const isOnline = useNetworkOnline()
    const [actions, setActions] = useState<ExerciseAction[]>(() => loadActions(workoutId))
    const [isSyncing, setIsSyncing] = useState(false)

    // Load actions from storage
    useEffect(() => {
        const saved = loadActions(workoutId)
        setActions(saved)
    }, [workoutId])

    // Persist actions to storage
    const persistActions = useCallback((newActions: ExerciseAction[]) => {
        try {
            const storage = typeof window !== 'undefined' ? window.localStorage : null
            if (!storage) return

            const key = `${OFFLINE_EXERCISE_QUEUE_KEY}_${workoutId}`
            const toStore = newActions.filter((a) => a.status !== 'synced')
            storage.setItem(key, JSON.stringify(toStore))
        } catch (error) {
            console.error('Failed to persist exercise actions:', error)
        }
    }, [workoutId])

    // Enqueue new action
    const enqueueAction = useCallback(
        (action: Omit<ExerciseAction, 'id' | 'createdAt' | 'status'>) => {
            const newAction: ExerciseAction = {
                ...action,
                id: generateId(),
                createdAt: Date.now(),
                status: 'pending',
            }

            const updated = [...actions, newAction]
            setActions(updated)
            persistActions(updated)

            // Show offline feedback if not online
            if (!isOnline) {
                toast.info(`${getActionLabel(action.type)} сохранено локально`)
            }

            return newAction.id
        },
        [actions, isOnline, persistActions],
    )

    // Mark action as synced
    const markSynced = useCallback(
        (actionId: string) => {
            const updated = actions.map((a) =>
                a.id === actionId ? { ...a, status: 'synced' as const } : a,
            )
            setActions(updated)
            persistActions(updated)
        },
        [actions, persistActions],
    )

    // Mark action as failed
    const markFailed = useCallback(
        (actionId: string, error: string) => {
            const updated = actions.map((a) =>
                a.id === actionId ? { ...a, status: 'failed' as const, lastError: error } : a,
            )
            setActions(updated)
            persistActions(updated)
        },
        [actions, persistActions],
    )

    // Retry failed action
    const retryAction = useCallback(
        async (actionId: string) => {
            const action = actions.find((a) => a.id === actionId)
            if (!action) return

            setIsSyncing(true)
            try {
                await syncAction(action)
                markSynced(actionId)
                toast.success('Действие синхронизировано')
            } catch (error) {
                markFailed(actionId, String(error))
                toast.error(`Ошибка: ${error}`)
            } finally {
                setIsSyncing(false)
            }
        },
        [actions, markSynced, markFailed],
    )

    // Retry all failed actions
    const retryAll = useCallback(async () => {
        const failed = actions.filter((a) => a.status === 'failed')
        if (failed.length === 0) return

        setIsSyncing(true)
        const results = await Promise.allSettled(failed.map((a) => syncAction(a)))
        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                markSynced(failed[idx].id)
            } else {
                markFailed(failed[idx].id, String(result.reason))
            }
        })
        setIsSyncing(false)
    }, [actions, markSynced, markFailed])

    // Sync all pending actions
    const syncAllPending = useCallback(async () => {
        const pending = actions.filter((a) => a.status === 'pending')
        if (pending.length === 0) return

        setIsSyncing(true)
        const results = await Promise.allSettled(pending.map((a) => syncAction(a)))
        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                markSynced(pending[idx].id)
            } else {
                markFailed(pending[idx].id, String(result.reason))
            }
        })
        setIsSyncing(false)
    }, [actions, markSynced, markFailed])

    // Auto-sync when online
    useEffect(() => {
        if (!isOnline) return
        if (isSyncing) return

        const pending = actions.filter((a) => a.status === 'pending')
        if (pending.length === 0) return

        const timeoutId = setTimeout(() => {
            void syncAllPending()
        }, 1000) // Wait 1s before auto-syncing

        return () => clearTimeout(timeoutId)
    }, [isOnline, actions, isSyncing, syncAllPending])

    const failedCount = actions.filter((a) => a.status === 'failed').length
    const pendingCount = actions.filter((a) => a.status === 'pending').length

    return {
        actions,
        failedCount,
        pendingCount,
        isSyncing,
        enqueueAction,
        markSynced,
        markFailed,
        retryAction,
        retryAll,
        syncAllPending,
    }
}

// Helpers
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getActionLabel(type: ExerciseActionType): string {
    const labels: Record<ExerciseActionType, string> = {
        ADD_SET: 'Подход добавлен',
        UPDATE_SET: 'Подход обновлён',
        REMOVE_SET: 'Подход удалён',
        UPDATE_EXERCISE: 'Упражнение обновлено',
    }
    return labels[type]
}

function loadActions(workoutId: number): ExerciseAction[] {
    try {
        const storage = typeof window !== 'undefined' ? window.localStorage : null
        if (!storage) return []

        const key = `${OFFLINE_EXERCISE_QUEUE_KEY}_${workoutId}`
        const raw = storage.getItem(key)
        if (!raw) return []

        return JSON.parse(raw) as ExerciseAction[]
    } catch (error) {
        console.error('Failed to load exercise actions:', error)
        return []
    }
}

/**
 * Mock sync function - in real implementation this would call the API.
 * For now, we'll simulate server response.
 */
async function syncAction(_action: ExerciseAction): Promise<void> {
    // In production, send to server here
    // For now, simulate network delay and success
    return new Promise((resolve) => {
        setTimeout(resolve, 500)
    })
}
