import { useMemo } from 'react'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'

type UpdateSetFn = (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void

type SetCurrentPositionFn = (exerciseIndex: number, setIndex: number) => void

interface UseWorkoutNavigationParams {
    activeExercises: CompletedExercise[]
    currentExerciseIndex: number
    currentSetIndex: number
    setCurrentPosition: SetCurrentPositionFn
    updateSet: UpdateSetFn
}

export function useWorkoutNavigation({
    activeExercises,
    currentExerciseIndex,
    currentSetIndex,
    setCurrentPosition,
    updateSet,
}: UseWorkoutNavigationParams) {
    const currentExercise = activeExercises[currentExerciseIndex] ?? null
    const normalizedCurrentSetIndex = currentExercise
        ? Math.min(Math.max(currentSetIndex, 0), Math.max(0, currentExercise.sets_completed.length - 1))
        : 0
    const currentSet = currentExercise?.sets_completed[normalizedCurrentSetIndex] ?? null

    const hasNextSet = Boolean(
        currentExercise && normalizedCurrentSetIndex < currentExercise.sets_completed.length - 1,
    )
    const hasPrevSet = Boolean(currentExercise && normalizedCurrentSetIndex > 0)
    const hasNextExercise = currentExerciseIndex < Math.max(0, activeExercises.length - 1)
    const hasPrevExercise = currentExerciseIndex > 0

    const remainingSets = useMemo(() => {
        if (!currentExercise) return 0
        return Math.max(0, currentExercise.sets_completed.length - (normalizedCurrentSetIndex + 1))
    }, [currentExercise, normalizedCurrentSetIndex])

    const goToPreviousPosition = () => {
        if (hasPrevSet) {
            setCurrentPosition(currentExerciseIndex, normalizedCurrentSetIndex - 1)
            return
        }

        if (hasPrevExercise) {
            const prevExerciseIndex = currentExerciseIndex - 1
            const prevExercise = activeExercises[prevExerciseIndex]
            const prevSetIndex = Math.max(0, prevExercise.sets_completed.length - 1)
            setCurrentPosition(prevExerciseIndex, prevSetIndex)
        }
    }

    const goToNextSet = () => {
        if (hasNextSet) {
            setCurrentPosition(currentExerciseIndex, normalizedCurrentSetIndex + 1)
            return
        }

        if (hasNextExercise) {
            setCurrentPosition(currentExerciseIndex + 1, 0)
        }
    }

    const goToNextExercise = () => {
        if (!hasNextExercise) return
        setCurrentPosition(currentExerciseIndex + 1, 0)
    }

    const goToPreviousExercise = () => {
        if (!hasPrevExercise) return
        setCurrentPosition(currentExerciseIndex - 1, 0)
    }

    const handleSkipCurrentSet = () => {
        if (!currentExercise || !currentSet) return
        updateSet(currentExerciseIndex, currentSet.set_number, { completed: false })
        goToNextSet()
    }

    return {
        currentExercise,
        currentSet,
        normalizedCurrentSetIndex,
        remainingSets,
        hasNextSet,
        hasPrevSet,
        hasNextExercise,
        hasPrevExercise,
        goToPreviousPosition,
        goToNextSet,
        goToNextExercise,
        goToPreviousExercise,
        handleSkipCurrentSet,
    }
}
