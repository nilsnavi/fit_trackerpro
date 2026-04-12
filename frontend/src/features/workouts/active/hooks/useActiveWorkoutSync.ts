import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { queryKeys } from '@shared/api/queryKeys'
import type { QueryClient } from '@tanstack/react-query'
import type { ActiveWorkoutSyncState } from '@/state/local'
import type {
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
import { toast } from '@shared/stores/toastStore'
import {
    emitWorkoutSyncTelemetry,
    syncErrorTelemetryFields,
} from '@shared/offline/observability/workoutSyncTelemetry'
import { isRecoverableSyncError } from '@shared/offline/syncQueue'
import {
    clearWorkoutDraftFromLocalStorage,
    writeWorkoutDraftToLocalStorage,
} from '@features/workouts/active/lib/workoutDraftLocalStorage'

// Aggressive debounce causes redundant requests; use a wider window instead.
const DEBOUNCE_MS = 2000
/** Паузы между повторами: 1 с, 2 с, 4 с. */
const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_DELAY_MS = 4000
const MAX_RETRY_ATTEMPTS = 3

type UpdateSessionMutation = {
    mutate: (
        variables: { workoutId: number; payload: WorkoutSessionUpdateRequest },
        options: {
            onSuccess: (data: WorkoutHistoryItem) => void
            onError?: (error: unknown) => void
        },
    ) => void
}

type BuildSyncPayload = (workout: WorkoutHistoryItem) => WorkoutSessionUpdateRequest

interface UseActiveWorkoutSyncParams {
    workoutId: number
    /** Ключ localStorage `workout_draft_${userId}_${workoutId}` */
    draftStorageUserId: string | number
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
    flushNow: () => Promise<void>
    syncState: ActiveWorkoutSyncState
    lastSyncedPayload: WorkoutSessionUpdateRequest | null
    pendingPayload: WorkoutSessionUpdateRequest | null
    isOffline: boolean
    hasPendingChanges: boolean
    /** Исчерпаны автоматические повторы синхронизации сессии */
    syncRetryExhausted: boolean
    /** Сбросить счётчик повторов и отправить снова (кнопка «Повторить») */
    retrySessionSyncNow: () => void
    /** Принять локальное состояние без блокировки UI (данные останутся в кэше / очереди) */
    dismissSessionSyncFailure: () => void
}

export function useActiveWorkoutSync({
    workoutId,
    draftStorageUserId,
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
    const getIsOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

    const [syncState, setSyncState] = useState<ActiveWorkoutSyncState>('idle')
    const [lastSyncedPayload, setLastSyncedPayload] = useState<WorkoutSessionUpdateRequest | null>(null)
    const [pendingPayload, setPendingPayload] = useState<WorkoutSessionUpdateRequest | null>(null)
    const [isOffline, setIsOffline] = useState<boolean>(() => !getIsOnline())
    const [syncRetryExhausted, setSyncRetryExhausted] = useState(false)

    // ── Snapshot tracking ──────────────────────────────────────────────────
    const lastPersistedSnapshotRef = useRef<string | null>(null)
    const hadSyncIssueRef = useRef(false)
    const hasShownOfflineToastRef = useRef(false)
    const retryAttemptRef = useRef(0)

    // ── Race condition guards ──────────────────────────────────────────────
    // inFlightRef prevents launching a second request while one is running.
    const inFlightRef = useRef(false)

    // ── Timer refs ─────────────────────────────────────────────────────────
    const debounceTimerRef = useRef<number | null>(null)
    const retryTimerRef = useRef<number | null>(null)
    const flushWaitersRef = useRef<Array<() => void>>([])

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
    const draftStorageUserIdRef = useRef(draftStorageUserId)
    draftStorageUserIdRef.current = draftStorageUserId

    // Indirection refs so executeSync / scheduleDebounced can reference each
    // other without circular useCallback dependencies.
    const executeSyncRef = useRef<() => void>(() => undefined)
    const scheduleDebouncedRef = useRef<() => void>(() => undefined)
    const updateSyncStateRef = useRef<(nextState: ActiveWorkoutSyncState) => void>(() => undefined)
    updateSyncStateRef.current = (nextState) => {
        setSyncState(nextState)
        setActiveSyncStateRef.current(nextState)
    }

    const resolveFlushWaiters = useCallback(() => {
        if (flushWaitersRef.current.length === 0) return
        const waiters = flushWaitersRef.current
        flushWaitersRef.current = []
        waiters.forEach((resolve) => {
            try {
                resolve()
            } catch {
                // noop
            }
        })
    }, [])

    const scheduleRetry = useCallback(() => {
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }

        if (retryAttemptRef.current >= MAX_RETRY_ATTEMPTS) {
            return
        }

        retryAttemptRef.current += 1
        const retryDelay = Math.min(
            RETRY_BASE_DELAY_MS * 2 ** (retryAttemptRef.current - 1),
            RETRY_MAX_DELAY_MS,
        )

        retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null
            executeSyncRef.current()
        }, retryDelay)
    }, [])

    // ── Core sync execution (stable identity) ─────────────────────────────
    const executeSync = useCallback(() => {
        const currentWorkout = workoutRef.current
        if (!isActiveDraftRef.current || !currentWorkout) {
            resolveFlushWaiters()
            return
        }

        // One request at a time — prevent race conditions.
        if (inFlightRef.current) return

        const payload = buildSyncPayloadRef.current(currentWorkout)
        const snapshot = JSON.stringify(payload)

        // Nothing new to persist.
        if (snapshot === lastPersistedSnapshotRef.current) {
            resolveFlushWaiters()
            return
        }

        setPendingPayload(payload)

        // Offline: mark as queued; the 'online' listener will retry.
        if (!getIsOnline()) {
            setIsOffline(true)
            writeWorkoutDraftToLocalStorage(draftStorageUserIdRef.current, workoutIdRef.current, payload)
            updateSyncStateRef.current('offline-queued')
            emitWorkoutSyncTelemetry('local_update_queued', {
                channel: 'active_session',
                workout_id: workoutIdRef.current,
                reason: 'flush_blocked_offline',
            })
            if (!hasShownOfflineToastRef.current) {
                toast.info('Офлайн: изменения поставлены в очередь синхронизации')
                hasShownOfflineToastRef.current = true
            }
            hadSyncIssueRef.current = true
            resolveFlushWaiters()
            return
        }

        inFlightRef.current = true
        updateSyncStateRef.current('syncing')
        emitWorkoutSyncTelemetry('sync_started', {
            channel: 'active_session',
            workout_id: workoutIdRef.current,
        })

        updateSessionMutationRef.current.mutate(
            { workoutId: workoutIdRef.current, payload },
            {
                onSuccess: (data) => {
                    const succeededAfterRetries = retryAttemptRef.current > 0
                    inFlightRef.current = false
                    setIsOffline(false)
                    setSyncRetryExhausted(false)
                    lastPersistedSnapshotRef.current = snapshot
                    retryAttemptRef.current = 0
                    setLastSyncedPayload(payload)
                    clearWorkoutDraftFromLocalStorage(draftStorageUserIdRef.current, workoutIdRef.current)
                    queryClientRef.current.setQueryData(detailQueryKeyRef.current, data)
                    updateSyncStateRef.current('synced')
                    emitWorkoutSyncTelemetry('sync_succeeded', {
                        channel: 'active_session',
                        workout_id: workoutIdRef.current,
                    })
                    if (succeededAfterRetries) {
                        emitWorkoutSyncTelemetry('retry_succeeded', {
                            channel: 'active_session',
                            workout_id: workoutIdRef.current,
                        })
                    }
                    if (hadSyncIssueRef.current) {
                        toast.success('Синхронизация восстановлена, изменения сохранены')
                    }
                    hadSyncIssueRef.current = false
                    hasShownOfflineToastRef.current = false

                    // New changes arrived while the request was in flight → flush them.
                    const latestWorkout = workoutRef.current
                    if (latestWorkout && isActiveDraftRef.current) {
                        const latestPayload = buildSyncPayloadRef.current(latestWorkout)
                        const latestSnapshot = JSON.stringify(latestPayload)
                        if (latestSnapshot !== lastPersistedSnapshotRef.current) {
                            setPendingPayload(latestPayload)
                            scheduleDebouncedRef.current()
                            return
                        }
                    }

                    setPendingPayload(null)
                    resolveFlushWaiters()
                },
                onError: (error: unknown) => {
                    inFlightRef.current = false
                    if (isRecoverableSyncError(error)) {
                        writeWorkoutDraftToLocalStorage(
                            draftStorageUserIdRef.current,
                            workoutIdRef.current,
                            payload,
                        )
                    }
                    updateSyncStateRef.current('error')
                    hadSyncIssueRef.current = true
                    emitWorkoutSyncTelemetry('sync_failed', {
                        channel: 'active_session',
                        workout_id: workoutIdRef.current,
                        outcome: 'mutation_error',
                        ...syncErrorTelemetryFields(error),
                    })
                    toast.retry('Ошибка синхронизации. Повторим автоматически', () => {
                        if (retryTimerRef.current !== null) {
                            window.clearTimeout(retryTimerRef.current)
                            retryTimerRef.current = null
                        }
                        setSyncRetryExhausted(false)
                        retryAttemptRef.current = 0
                        executeSyncRef.current()
                    })
                    scheduleRetry()
                    if (retryAttemptRef.current >= MAX_RETRY_ATTEMPTS && retryTimerRef.current === null) {
                        setSyncRetryExhausted(true)
                    }
                    resolveFlushWaiters()
                },
            },
        )
    }, [resolveFlushWaiters, scheduleRetry]) // reads mutable inputs via refs

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
        retryAttemptRef.current = 0
        setSyncRetryExhausted(false)
        debounceTimerRef.current = window.setTimeout(() => {
            debounceTimerRef.current = null
            executeSyncRef.current()
        }, DEBOUNCE_MS)
    }, []) // stable

    scheduleDebouncedRef.current = scheduleDebounced

    // ── Flush (stable, exposed to caller) ─────────────────────────────────
    const flushNow = useCallback(() => {
        return new Promise<void>((resolve) => {
            flushWaitersRef.current.push(resolve)

            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current)
                debounceTimerRef.current = null
            }
            if (retryTimerRef.current !== null) {
                window.clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
            retryAttemptRef.current = 0
            setSyncRetryExhausted(false)

            const currentWorkout = workoutRef.current
            const hasUnsyncedChanges =
                Boolean(isActiveDraftRef.current) &&
                Boolean(currentWorkout) &&
                lastPersistedSnapshotRef.current !== null &&
                JSON.stringify(buildSyncPayloadRef.current(currentWorkout as WorkoutHistoryItem)) !==
                lastPersistedSnapshotRef.current

            if (!inFlightRef.current && !hasUnsyncedChanges) {
                resolveFlushWaiters()
                return
            }

            executeSyncRef.current()
        })
    }, [resolveFlushWaiters])

    const hasUnsyncedChanges = useCallback(() => {
        const currentWorkout = workoutRef.current
        if (!isActiveDraftRef.current || !currentWorkout || lastPersistedSnapshotRef.current === null) {
            return false
        }

        const latestSnapshot = JSON.stringify(buildSyncPayloadRef.current(currentWorkout))
        return latestSnapshot !== lastPersistedSnapshotRef.current
    }, [])

    const flushPendingChanges = useCallback(() => {
        if (hasUnsyncedChanges()) {
            flushNow()
        }
    }, [flushNow, hasUnsyncedChanges])

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
        retryAttemptRef.current = 0
        setSyncRetryExhausted(false)
        setLastSyncedPayload(null)
        setPendingPayload(null)
        updateSyncStateRef.current('idle')
    }, [workoutId])

    const retrySessionSyncNow = useCallback(() => {
        setSyncRetryExhausted(false)
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        retryAttemptRef.current = 0
        executeSyncRef.current()
    }, [])

    const dismissSessionSyncFailure = useCallback(() => {
        setSyncRetryExhausted(false)
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }
        retryAttemptRef.current = 0
        updateSyncStateRef.current('saved-locally')
    }, [])

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
    const activeSessionPayload = useMemo(
        () => (isActiveDraft && workout ? buildSyncPayload(workout) : null),
        [buildSyncPayload, isActiveDraft, workout],
    )
    const activeSessionSnapshot = useMemo(
        () => (activeSessionPayload ? JSON.stringify(activeSessionPayload) : null),
        [activeSessionPayload],
    )

    useEffect(() => {
        if (!isActiveDraft || !activeSessionSnapshot || !activeSessionPayload) return

        // Establish baseline on first load — nothing to persist yet.
        if (lastPersistedSnapshotRef.current === null) {
            lastPersistedSnapshotRef.current = activeSessionSnapshot
            setLastSyncedPayload(activeSessionPayload)
            setPendingPayload(null)
            updateSyncStateRef.current('idle')
            return
        }

        // Already up-to-date.
        if (activeSessionSnapshot === lastPersistedSnapshotRef.current) {
            setPendingPayload(null)
            return
        }

        setPendingPayload(activeSessionPayload)
        scheduleDebounced()
        // Мгновенный фидбэк: пользователь видит что изменение захвачено локально,
        // до того как debounce отправит его на сервер.
        updateSyncStateRef.current('saved-locally')
        emitWorkoutSyncTelemetry('local_update_queued', {
            channel: 'active_session',
            workout_id: workoutIdRef.current,
            reason: 'debounced_local_edit',
        })
    }, [activeSessionPayload, activeSessionSnapshot, isActiveDraft, scheduleDebounced])

    // ── Flush triggers: blur / hidden tab / page unload ───────────────────
    useEffect(() => {
        if (!isActiveDraft) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushPendingChanges()
            }
        }

        const handleBlur = () => flushPendingChanges()

        const handleBeforeUnload = () => {
            // Best-effort — async requests may not complete but the debounce is cleared.
            flushPendingChanges()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [isActiveDraft, flushPendingChanges])

    // ── Online recovery ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isActiveDraft) return

        const handleOnline = () => {
            setIsOffline(false)
            // Cancel any pending debounce to avoid a duplicate request racing
            // with the reconnect flush (Bug 1: duplicate mutations on reconnect).
            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current)
                debounceTimerRef.current = null
            }
            // Always attempt a flush — executeSync guards via inFlightRef and
            // snapshot comparison, so calling it unconditionally is safe.
            // This also handles Bug 5: when lastPersistedSnapshotRef is still null
            // (app opened offline before first baseline was established).
            if (isActiveDraftRef.current) {
                executeSyncRef.current()
            }
        }

        const handleOffline = () => {
            setIsOffline(true)
            if (hasUnsyncedChanges()) {
                updateSyncStateRef.current('offline-queued')
                emitWorkoutSyncTelemetry('local_update_queued', {
                    channel: 'active_session',
                    workout_id: workoutIdRef.current,
                    reason: 'navigator_offline_unsynced',
                })
            }
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [isActiveDraft, hasUnsyncedChanges])

    const hasPendingChanges = pendingPayload !== null

    return {
        flushNow,
        syncState,
        lastSyncedPayload,
        pendingPayload,
        isOffline,
        hasPendingChanges,
        syncRetryExhausted,
        retrySessionSyncNow,
        dismissSessionSyncFailure,
    }
}
