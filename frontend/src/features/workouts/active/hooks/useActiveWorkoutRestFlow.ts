import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompletedExercise, CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { toast } from '@shared/stores/toastStore'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import { formatSetSnapshot } from '../lib/activeWorkoutUtils'

export interface UseActiveWorkoutRestFlowParams {
    workout: WorkoutHistoryItem | undefined
    profileId: number | undefined
    templateId: number | null | undefined
    previousBestByExercise: Map<string, CompletedSet>
    restDefaultSeconds: number
    restTimer: { durationSeconds: number; remainingSeconds: number }
    scopedDefaultRestSeconds: number
    restPresets: number[]
    setRestDefaultSeconds: (seconds: number) => void
    setDefaultRestForScope: (scopeKey: string, seconds: number) => void
    setPresetsForScope: (scopeKey: string, presets: number[]) => void
    startRestTimer: (seconds: number) => void
    setCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    updateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    setLastCompletedSet: (value: { exerciseIndex: number; setNumber: number } | null) => void
    tg: UseTelegramWebAppReturn
}

export interface UseActiveWorkoutRestFlowResult {
    restPresetScopeKey: string
    previousBestLabelsByExercise: Map<string, string>
    isRestPresetsModalOpen: boolean
    restPresetsDraft: string
    openRestPresets: () => void
    closeRestPresets: () => void
    setRestPresetsDraft: (value: string) => void
    handleSelectRestPreset: (seconds: number) => void
    handleSaveRestPresets: () => void
    getTrackedRestPatch: (exerciseIndex: number, setNumber: number) => Partial<CompletedSet>
    handleToggleSetCompleted: (
        exerciseIndex: number,
        setNumber: number,
        nextCompleted: boolean,
        options?: { skipAutoRestTimer?: boolean },
    ) => void
    handleStartQuickRest: () => void
}

function parseRestPresetsDraft(value: string): number[] {
    return value
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((seconds) => Number.isFinite(seconds))
}

export function useActiveWorkoutRestFlow({
    workout,
    profileId,
    templateId,
    previousBestByExercise,
    restDefaultSeconds,
    restTimer,
    scopedDefaultRestSeconds,
    restPresets,
    setRestDefaultSeconds,
    setDefaultRestForScope,
    setPresetsForScope,
    startRestTimer,
    setCurrentPosition,
    updateSet,
    setLastCompletedSet,
    tg,
}: UseActiveWorkoutRestFlowParams): UseActiveWorkoutRestFlowResult {
    const restPresetScopeKey = useMemo(() => {
        const userKey = profileId != null ? String(profileId) : 'anon'
        const templateKey = templateId != null ? String(templateId) : 'default'
        return `${userKey}:${templateKey}`
    }, [profileId, templateId])

    const previousBestLabelsByExercise = useMemo(() => {
        const bestLabels = new Map<string, string>()
        previousBestByExercise.forEach((set, exerciseName) => {
            bestLabels.set(exerciseName.trim().toLowerCase(), formatSetSnapshot(set))
        })
        return bestLabels
    }, [previousBestByExercise])

    const [isRestPresetsModalOpen, setIsRestPresetsModalOpen] = useState<boolean>(false)
    const [restPresetsDraft, setRestPresetsDraft] = useState<string>('')

    useEffect(() => {
        if (restDefaultSeconds !== scopedDefaultRestSeconds) {
            setRestDefaultSeconds(scopedDefaultRestSeconds)
        }
    }, [restDefaultSeconds, scopedDefaultRestSeconds, setRestDefaultSeconds])

    useEffect(() => {
        if (!isRestPresetsModalOpen) return
        setRestPresetsDraft(restPresets.join(', '))
    }, [isRestPresetsModalOpen, restPresets])

    const openRestPresets = useCallback(() => setIsRestPresetsModalOpen(true), [])
    const closeRestPresets = useCallback(() => setIsRestPresetsModalOpen(false), [])

    const handleSelectRestPreset = useCallback((seconds: number) => {
        setRestDefaultSeconds(seconds)
        setDefaultRestForScope(restPresetScopeKey, seconds)
    }, [restPresetScopeKey, setDefaultRestForScope, setRestDefaultSeconds])

    const handleSaveRestPresets = useCallback(() => {
        const parsed = parseRestPresetsDraft(restPresetsDraft)
        setPresetsForScope(restPresetScopeKey, parsed)
        setIsRestPresetsModalOpen(false)
        toast.success('Пресеты отдыха обновлены')
    }, [restPresetScopeKey, restPresetsDraft, setPresetsForScope])

    const getTrackedRestPatch = useCallback((exerciseIndex: number, setNumber: number): Partial<CompletedSet> => {
        const exercise: CompletedExercise | undefined = workout?.exercises[exerciseIndex]
        if (!exercise || !workout) return {}

        const hasPriorCompletedSet = workout.exercises.some((item, index) => {
            if (index < exerciseIndex) {
                return item.sets_completed.some((set) => set.completed)
            }
            if (index > exerciseIndex) {
                return false
            }
            return item.sets_completed.some((set) => set.set_number < setNumber && set.completed)
        })

        if (!hasPriorCompletedSet) {
            return {}
        }

        const trackedRestSeconds =
            restTimer.durationSeconds > 0
                ? Math.max(0, restTimer.durationSeconds - restTimer.remainingSeconds)
                : undefined

        return {
            planned_rest_seconds: restTimer.durationSeconds > 0 ? restTimer.durationSeconds : restDefaultSeconds,
            actual_rest_seconds: trackedRestSeconds,
            rest_seconds: trackedRestSeconds,
        }
    }, [restDefaultSeconds, restTimer.durationSeconds, restTimer.remainingSeconds, workout])

    const handleToggleSetCompleted = useCallback(
        (
            exerciseIndex: number,
            setNumber: number,
            nextCompleted: boolean,
            options?: { skipAutoRestTimer?: boolean },
        ) => {
            tg.hapticFeedback({ type: 'selection' })
            setCurrentPosition(exerciseIndex, setNumber - 1)
            updateSet(exerciseIndex, setNumber, {
                completed: nextCompleted,
                ...(nextCompleted
                    ? {
                          ...getTrackedRestPatch(exerciseIndex, setNumber),
                          completed_at: new Date().toISOString(),
                      }
                    : {
                          completed_at: undefined,
                          started_at: undefined,
                      }),
            })
            if (nextCompleted) {
                setLastCompletedSet({ exerciseIndex, setNumber })
                if (!options?.skipAutoRestTimer) {
                    startRestTimer(restDefaultSeconds)
                }
            }
        },
        [
            getTrackedRestPatch,
            restDefaultSeconds,
            setCurrentPosition,
            setLastCompletedSet,
            startRestTimer,
            tg,
            updateSet,
        ],
    )

    const handleStartQuickRest = useCallback(() => {
        tg.hapticFeedback({ type: 'selection' })
        startRestTimer(restDefaultSeconds)
    }, [restDefaultSeconds, startRestTimer, tg])

    return {
        restPresetScopeKey,
        previousBestLabelsByExercise,
        isRestPresetsModalOpen,
        restPresetsDraft,
        openRestPresets,
        closeRestPresets,
        setRestPresetsDraft,
        handleSelectRestPreset,
        handleSaveRestPresets,
        getTrackedRestPatch,
        handleToggleSetCompleted,
        handleStartQuickRest,
    }
}

