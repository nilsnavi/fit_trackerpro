import { useEffect, useRef } from 'react'
import { queryKeys } from '@shared/api/queryKeys'
import type { QueryClient } from '@tanstack/react-query'
import type { ActiveWorkoutSyncState } from '@/state/local'
import type {
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'

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
}: UseActiveWorkoutSyncParams) {
    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)
    const lastPersistedSnapshotRef = useRef<string | null>(null)
    const lastAttemptedSnapshotRef = useRef<string | null>(null)

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

    useEffect(() => {
        lastPersistedSnapshotRef.current = null
        lastAttemptedSnapshotRef.current = null
    }, [workoutId])

    const activeSessionPayload = isActiveDraft && workout ? buildSyncPayload(workout) : null
    const activeSessionSnapshot = activeSessionPayload ? JSON.stringify(activeSessionPayload) : null

    useEffect(() => {
        if (!isActiveDraft || !activeSessionPayload || !activeSessionSnapshot) return

        if (lastPersistedSnapshotRef.current == null) {
            lastPersistedSnapshotRef.current = activeSessionSnapshot
            lastAttemptedSnapshotRef.current = activeSessionSnapshot
            return
        }

        if (
            lastPersistedSnapshotRef.current === activeSessionSnapshot ||
            lastAttemptedSnapshotRef.current === activeSessionSnapshot
        ) {
            return
        }

        const timeout = window.setTimeout(() => {
            lastAttemptedSnapshotRef.current = activeSessionSnapshot
            setActiveSyncState('syncing')
            updateSessionMutation.mutate(
                { workoutId, payload: activeSessionPayload },
                {
                    onSuccess: (data) => {
                        lastPersistedSnapshotRef.current = activeSessionSnapshot
                        queryClient.setQueryData(detailQueryKey, data)
                        setActiveSyncState('synced')
                    },
                    onError: () => {
                        setActiveSyncState('error')
                    },
                },
            )
        }, 500)

        return () => {
            window.clearTimeout(timeout)
        }
    }, [
        activeSessionPayload,
        activeSessionSnapshot,
        detailQueryKey,
        isActiveDraft,
        queryClient,
        setActiveSyncState,
        updateSessionMutation,
        workoutId,
    ])
}
