import { useEffect } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import type { ActiveWorkoutSessionDraft } from '@/stores/activeWorkoutSessionDraftStore'

export interface UseActiveWorkoutLifecycleParams {
    workoutId: number
    workout: WorkoutHistoryItem | undefined
    isActiveDraft: boolean
    elapsedSeconds: number
    currentExerciseIndex: number
    currentSetIndex: number
    restDefaultSeconds: number
    tg: UseTelegramWebAppReturn
    navigate: NavigateFunction
    getActiveWorkoutDraft: () => ActiveWorkoutSessionDraft | null
    initializeActiveWorkoutDraft: (data: ActiveWorkoutSessionDraft) => void
    clearActiveWorkoutDraft: () => void
    buildSyncPayload: (workout: WorkoutHistoryItem) => unknown
}

export interface UseActiveWorkoutLifecycleResult {}

export function useActiveWorkoutLifecycle({
    workout,
    isActiveDraft,
    elapsedSeconds,
    currentExerciseIndex,
    currentSetIndex,
    restDefaultSeconds,
    tg,
    navigate,
    getActiveWorkoutDraft,
    initializeActiveWorkoutDraft,
    clearActiveWorkoutDraft,
    buildSyncPayload,
}: UseActiveWorkoutLifecycleParams): UseActiveWorkoutLifecycleResult {
    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => navigate('/workouts'))
        }
        return () => {
            hideBackButton()
        }
    }, [tg, navigate])

    useEffect(() => {
        if (!workout || !isActiveDraft) return

        const existingDraft = getActiveWorkoutDraft()
        if (existingDraft?.workoutId === workout.id) {
            return
        }

        const startedAtMs = Date.parse(workout.created_at)
        initializeActiveWorkoutDraft({
            workoutId: workout.id,
            templateId: workout.template_id ?? null,
            startedAt: Number.isNaN(startedAtMs) ? Date.now() : startedAtMs,
            exercises: workout.exercises,
            elapsedSeconds,
            currentExerciseIndex,
            currentSetIndex,
            comments: workout.comments,
            tags: workout.tags ?? [],
            restDefaultSeconds,
            lastSyncedAt: Date.now(),
            lastSyncedVersion: 0,
            lastSyncedPayload: JSON.stringify(buildSyncPayload(workout)),
            pendingOperationIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })
    }, [
        currentExerciseIndex,
        currentSetIndex,
        elapsedSeconds,
        getActiveWorkoutDraft,
        initializeActiveWorkoutDraft,
        isActiveDraft,
        buildSyncPayload,
        restDefaultSeconds,
        workout,
    ])

    useEffect(() => {
        if (!workout) return
        const isCompleted = typeof workout.duration === 'number' && workout.duration > 0
        if (isCompleted) {
            clearActiveWorkoutDraft()
        }
    }, [clearActiveWorkoutDraft, workout])

    useEffect(() => {
        if (!isActiveDraft) return

        const timeoutId = window.setTimeout(() => {
            document.getElementById('current-active-set')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            })
        }, 100)

        return () => window.clearTimeout(timeoutId)
    }, [currentExerciseIndex, currentSetIndex, isActiveDraft])

    return {}
}

