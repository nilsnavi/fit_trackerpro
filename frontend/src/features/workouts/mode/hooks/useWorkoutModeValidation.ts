import { useCallback, useMemo } from 'react'
import { useWorkoutModeEditorStore } from '@features/workouts/model/useWorkoutModeEditorStore'
import type {
    UseWorkoutModeValidationParams,
    UseWorkoutModeValidationResult,
} from './useWorkoutModeValidation.types'
import type {
    CardioExerciseParams,
    FunctionalExerciseParams,
    StrengthExerciseParams,
    WorkoutModeExerciseItem,
    YogaExerciseParams,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'

function isExerciseFormValid(item: WorkoutModeExerciseItem): boolean {
    if (item.mode === 'strength') {
        const params = item.params as StrengthExerciseParams
        return Number.isFinite(params.sets)
            && params.sets >= 1
            && Number.isFinite(params.reps)
            && params.reps >= 1
            && Number.isFinite(params.restSeconds)
            && params.restSeconds >= 0
    }

    if (item.mode === 'cardio') {
        const params = item.params as CardioExerciseParams
        const hasDuration = Number.isFinite(params.durationSeconds) && params.durationSeconds > 0
        const hasDistance = Number.isFinite(params.distance) && (params.distance as number) > 0
        return hasDuration || hasDistance
    }

    if (item.mode === 'functional') {
        const params = item.params as FunctionalExerciseParams
        const hasReps = Number.isFinite(params.reps) && (params.reps as number) > 0
        const hasDuration = Number.isFinite(params.durationSeconds) && (params.durationSeconds as number) > 0
        return Number.isFinite(params.rounds)
            && params.rounds >= 1
            && Number.isFinite(params.restSeconds)
            && params.restSeconds >= 0
            && (hasReps || hasDuration)
    }

    if (item.mode === 'yoga') {
        const params = item.params as YogaExerciseParams
        return Number.isFinite(params.durationSeconds) && params.durationSeconds > 0
    }

    return true
}

export function useWorkoutModeValidation({
    editorTitle,
    editorExercises,
    validate,
    onSave,
    onSaveAndStart,
}: UseWorkoutModeValidationParams): UseWorkoutModeValidationResult {
    const isEditorInvalid = useMemo(() => {
        if (!editorTitle.trim()) return true
        if (editorExercises.length === 0) return true
        return editorExercises.some((exercise) => !isExerciseFormValid(exercise))
    }, [editorExercises, editorTitle])

    const scrollToFirstInvalidField = useCallback(() => {
        const { validationErrors } = useWorkoutModeEditorStore.getState()
        const targetId = validationErrors.title
            ? 'workout-mode-title-input'
            : validationErrors.exercises
                ? 'workout-mode-exercises'
                : null

        if (!targetId) return

        const target = document.getElementById(targetId)
        if (!target) return

        if (target instanceof HTMLElement) {
            target.focus({ preventScroll: true })
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [])

    const handleSaveWithValidationUx = useCallback(() => {
        const isValid = validate()
        if (!isValid) {
            requestAnimationFrame(scrollToFirstInvalidField)
            return
        }
        onSave()
    }, [onSave, scrollToFirstInvalidField, validate])

    const handleSaveAndStartWithValidationUx = useCallback(async () => {
        const isValid = validate()
        if (!isValid) {
            requestAnimationFrame(scrollToFirstInvalidField)
            return
        }
        await onSaveAndStart()
    }, [onSaveAndStart, scrollToFirstInvalidField, validate])

    return {
        isEditorInvalid,
        handleSaveWithValidationUx,
        handleSaveAndStartWithValidationUx,
    }
}
