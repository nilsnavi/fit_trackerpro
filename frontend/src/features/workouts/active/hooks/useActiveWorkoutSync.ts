import { useCallback, useEffect, useRef } from 'react'
import { queryKeys } from '@shared/api/queryKeys'
import type { QueryClient } from '@tanstack/react-query'
import type { ActiveWorkoutSyncState } from '@/state/local'
import type {
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
import { toast } from '@shared/stores/toastStore'

// Aggressive debounce causes redundant requests; use a wider window instead.
const DEBOUNCE_MS = 2000
const RETRY_DELAY_MS = 5000

type UpdateSessionMutation = {
    mutate: (
        variables: { workoutId: number; payload: WorkoutSessionUpdateRequest },
        options: {
            onSuccess: (data: WorkoutHistoryItem) => void
            onError: () => void
        },
    ) => void
}

type BuildSyncPayload = (workout: WorkoutHistoryItem) => WorkoutSessionUpdateRequest

interface UseActiveWorkoutSyncParams {
    workoutId: number
    workout: WorkoutHistoryItem | undefined
    draftWorkoutId: number | null
    isActiveDraft: boolean
    activeExercises: WorkoutHistoryItem['exercises']
    startedAt: number | null
    queryClient: QueryClient
    initializeActiveSession: (payload: {
        sessionId: number
        startedAt: number
        exercises: WorkoutHistoryItem['exercises']
    }) => void
    setActiveExercises: (exercises: WorkoutHistoryItem['exercises']) => void
    setCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    setActiveElapsedSeconds: (elapsedSeconds: number) => void
    setActiveSyncState: (syncState: ActiveWorkoutSyncState) => void
    clearWorkoutSessionDraft: () => void
    updateSessionMutation: UpdateSessionMutation
    buildSyncPayload: BuildSyncPayload
}

interface UseActiveWorkoutSyncResult {
    /** Immediately cancel any pending debounce and fire sync now. Use before navigation / finish. */
    flushNow: () => void
}

export function useActiveWorkoutSync({
    workoutId,
    workout,
    draftWorkoutId,
    isActiveDraft,
    activeExercises,
    startedAt,
    queryClient,
    initializeActiveSession,
    setActiveExercises,
    setCurrentPosition,
    setActiveElapsedSeconds,
    setActiveSyncState,
    clearWorkoutSessionDraft,
    updateSessionMutation,
    buildSyncPayload,
}: UseActiveWorkoutSyncParams): UseActiveWorkoutSyncResult {
    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)

    // ── Snapshot tracking ──────────────────────────────────────────────────
    const lastPersistedSnapshotRef = useRef<string | null>(null)
    const hadSyncIssueRef = useRef(false)
    const hasShownOfflineToastRef = useRef(false)

    // ── Race condition guards ──────────────────────────────────────────────
    // inFlightRef prevents launching a second request while one is running.
    const inFlightRef = useRef(false)

    // ── Timer refs ─────────────────────────────────────────────────────────
    const debounceTimerRef = useRef<number | null>(null)
    const retryTimerRef = useRef<number | null>(null)

    // ── Stable refs for latest mutable values ─────────────────────────────
    // Updated every render so callbacks with [] deps always read fresh values.
    const workoutRef = useRef(workout)
    workoutRef.current = workout
    const isActiveDraftRef = useRef(isActiveDraft)
    isActiveDraftRef.current = isActiveDraft
    const buildSyncPayloadRef = useRef(buildSyncPayload)
    buildSyncPayloadRef.current = buildSyncPayload
    const updateSessionMutationRef = useRef(updateSessionMutation)
    updateSessionMutationRef.current = updateSessionMutation
    const setActiveSyncStateRef = useRef(setActiveSyncState)
    setActiveSyncStateRef.current = setActiveSyncState
    const queryClientRef = useRef(queryClient)
    queryClientRef.current = queryClient
    const workoutIdRef = useRef(workoutId)
    workoutIdRef.current = workoutId
    const detailQueryKeyRef = useRef(detailQueryKey)
    detailQueryKeyRef.current = detailQueryKey

    // Indirection refs so executeSync / scheduleDebounced can reference each
    // other without circular useCallback dependencies.
    const executeSyncRef = useRef<() => void>(() => undefined)
    const scheduleDebouncedRef = useRef<() => void>(() => undefined)

    // ── Core sync execution (stable identity) ─────────────────────────────
    const executeSync = useCallback(() => {
        const currentWorkout = workoutRef.current
        if (!isActiveDraftRef.current || !currentWorkout) return

        // One request at a time — prevent race conditions.
        if (inFlightRef.current) return

        const payload = buildSyncPayloadRef.current(currentWorkout)
        const snapshot = JSON.stringify(payload)

        // Nothing new to persist.
        if (snapshot === lastPersistedSnapshotRef.current) return

        // Offline: mark as queued; the 'online' listener will retry.
        if (!navigator.onLine) {
            setActiveSyncStateRef.current('offline-queued')
            if (!hasShownOfflineToastRef.current) {
                toast.info('Офлайн: изменения поставлены в очередь синхронизации')
                hasShownOfflineToastRef.current = true
            }
            hadSyncIssueRef.current = true
            return
        }

        inFlightRef.current = true
        setActiveSyncStateRef.current('syncing')

        updateSessionMutationRef.current.mutate(
            { workoutId: workoutIdRef.current, payload },
            {
                onSuccess: (data) => {
                    inFlightRef.current = false
                    lastPersistedSnapshotRef.current = snapshot
                    queryClientRef.current.setQueryData(detailQueryKeyRef.current, data)
                    setActiveSyncStateRef.current('synced')
                    if (hadSyncIssueRef.current) {
                        toast.success('Синхронизация восстановлена, изменения сохранены')
                    }
                    hadSyncIssueRef.current = false
                    hasShownOfflineToastRef.current = false

                    // New changes arrived while the request was in flight → flush them.
                    const latestWorkout = workoutRef.current
                    if (latestWorkout && isActiveDraftRef.current) {
                        const latestSnapshot = JSON.stringify(buildSyncPayloadRef.current(latestWorkout))
                        if (latestSnapshot !== lastPersistedSnapshotRef.current) {
                            scheduleDebouncedRef.current()
                        }
                    }
                },
                onError: () => {
                    inFlightRef.current = false
                    setActiveSyncStateRef.current('error')
                    hadSyncIssueRef.current = true
                    toast.retry('Ошибка синхронизации. Повторим автоматически')
                    // Auto-retry after a delay; cleared if new changes arrive first.
                    retryTimerRef.current = window.setTimeout(() => {
                        retryTimerRef.current = null
                        executeSyncRef.current()
                    }, RETRY_DELAY_MS)
                },
            },
        )
    }, []) // intentionally empty — reads everything via refs

    executeSyncRef.current = executeSync

    // ── Debounced schedule (stable identity) ──────────────────────────────
    const scheduleDebounced = useCallback(() => {
        // Clear any pending debounce or retry so they don't race.
        if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current)
        }
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        debounceTimerRef.current = window.setTimeout(() => {
            debounceTimerRef.current = null
            executeSyncRef.current()
        }, DEBOUNCE_MS)
    }, []) // stable

    scheduleDebouncedRef.current = scheduleDebounced

    // ── Flush (stable, exposed to caller) ─────────────────────────────────
    const flushNow = useCallback(() => {
        if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        executeSyncRef.current()
    }, []) // stable

    // ── Timer cleanup on unmount ───────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current)
            if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
        }
    }, [])

    // ── Reset tracking when session changes ───────────────────────────────
    useEffect(() => {
        lastPersistedSnapshotRef.current = null
        inFlightRef.current = false
    }, [workoutId])

    // ── Session housekeeping (unchanged from original) ────────────────────

    useEffect(() => {
        if (!workout || workout.id !== draftWorkoutId) return
        const duration = workout.duration
        if (typeof duration === 'number' && duration > 0) {
            clearWorkoutSessionDraft()
        }
    }, [workout, draftWorkoutId, clearWorkoutSessionDraft])

    useEffect(() => {
        if (!workout || !isActiveDraft) return
        const startedAtMs = Date.parse(workout.created_at)
        initializeActiveSession({
            sessionId: workout.id,
            startedAt: Number.isNaN(startedAtMs) ? Date.now() : startedAtMs,
            exercises: workout.exercises,
        })
    }, [initializeActiveSession, isActiveDraft, workout])

    useEffect(() => {
        if (!workout || !isActiveDraft) return
        setActiveExercises(workout.exercises)
    }, [isActiveDraft, setActiveExercises, workout])

    useEffect(() => {
        if (!isActiveDraft || activeExercises.length === 0) return

        const firstIncomplete = activeExercises
            .map((exercise, exerciseIndex) => {
                const setIndex = exercise.sets_completed.findIndex((set) => !set.completed)
                if (setIndex < 0) return null
                return { exerciseIndex, setIndex }
            })
            .find((value): value is { exerciseIndex: number; setIndex: number } => value != null)

        if (firstIncomplete) {
            setCurrentPosition(firstIncomplete.exerciseIndex, firstIncomplete.setIndex)
            return
        }

        const lastExerciseIndex = activeExercises.length - 1
        const lastSetIndex = Math.max(0, activeExercises[lastExerciseIndex].sets_completed.length - 1)
        setCurrentPosition(lastExerciseIndex, lastSetIndex)
    }, [activeExercises, isActiveDraft, setCurrentPosition])

    useEffect(() => {
        if (!isActiveDraft || startedAt == null) return

        setActiveElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        const interval = window.setInterval(() => {
            setActiveElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        }, 1000)

        return () => {
            window.clearInterval(interval)
        }
    }, [isActiveDraft, setActiveElapsedSeconds, startedAt])

    // ── Watch workout snapshot → schedule debounced sync ──────────────────
    // Compare by serialised string so the effect only fires on real data changes,
    // not on every re-render (avoids the new-object-reference pitfall).
    const activeSessionSnapshot = isActiveDraft && workout ? JSON.stringify(buildSyncPayload(workout)) : null

    useEffect(() => {
        if (!isActiveDraft || !activeSessionSnapshot) return

        // Establish baseline on first load — nothing to persist yet.
        if (lastPersistedSnapshotRef.current === null) {
            lastPersistedSnapshotRef.current = activeSessionSnapshot
            return
        }

        // Already up-to-date.
        if (activeSessionSnapshot === lastPersistedSnapshotRef.current) return

        scheduleDebounced()
    }, [activeSessionSnapshot, isActiveDraft, scheduleDebounced])

    // ── Flush triggers: blur / hidden tab / page unload ───────────────────
    useEffect(() => {
        if (!isActiveDraft) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushNow()
            }
        }

        const handleBlur = () => flushNow()

        const handleBeforeUnload = () => {
            // Best-effort — async requests may not complete but the debounce is cleared.
            flushNow()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [isActiveDraft, flushNow])

    // ── Online recovery ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isActiveDraft) return

        const handleOnline = () => {
            // Flush queued changes as soon as the connection is restored.
            if (
                lastPersistedSnapshotRef.current !== null &&
                workoutRef.current &&
                JSON.stringify(buildSyncPayloadRef.current(workoutRef.current)) !==
                    lastPersistedSnapshotRef.current
            ) {
                executeSyncRef.current()
            }
        }

        window.addEventListener('online', handleOnline)
        return () => window.removeEventListener('online', handleOnline)
    }, [isActiveDraft])

    return { flushNow }
}
