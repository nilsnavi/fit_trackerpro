import { useMemo } from 'react'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'

export interface ActiveWorkoutContextCardModel {
    exerciseName: string
    previousBest: string
    currentSetLabel: string
    remainingSets: number
}

export interface UseActiveWorkoutContextCardParams {
    currentExercise: CompletedExercise | null
    currentSet: CompletedSet | null
    normalizedCurrentSetIndex: number
    remainingSets: number
    previousBestByExercise: Map<string, CompletedSet>
}

export function useActiveWorkoutContextCard({
    currentExercise,
    currentSet,
    normalizedCurrentSetIndex,
    remainingSets,
    previousBestByExercise,
}: UseActiveWorkoutContextCardParams): ActiveWorkoutContextCardModel {
    return useMemo(() => {
        const fallback: ActiveWorkoutContextCardModel = {
            exerciseName: 'Подготовка тренировки',
            previousBest: 'Нет данных',
            currentSetLabel: '—',
            remainingSets: 0,
        }

        if (!currentExercise || !currentSet) return fallback

        const bestSet = previousBestByExercise.get(currentExercise.name)
        const bestParts = [
            bestSet?.weight != null ? `${bestSet.weight} кг` : null,
            bestSet?.reps != null ? `${bestSet.reps} повт` : null,
            bestSet?.duration != null ? `${bestSet.duration} сек` : null,
            bestSet?.distance != null ? `${bestSet.distance} км` : null,
        ].filter((part): part is string => Boolean(part))

        const currentParts = [
            currentSet.weight != null ? `${currentSet.weight} кг` : null,
            currentSet.reps != null ? `${currentSet.reps} повт` : null,
            currentSet.duration != null ? `${currentSet.duration} сек` : null,
            currentSet.distance != null ? `${currentSet.distance} км` : null,
        ].filter((part): part is string => Boolean(part))

        return {
            exerciseName: currentExercise.name,
            previousBest: bestParts.length > 0 ? bestParts.join(' • ') : 'Нет данных',
            currentSetLabel: `Подход ${normalizedCurrentSetIndex + 1}/${currentExercise.sets_completed.length}${currentParts.length > 0 ? ` • ${currentParts.join(' • ')}` : ''}`,
            remainingSets,
        }
    }, [currentExercise, currentSet, normalizedCurrentSetIndex, previousBestByExercise, remainingSets])
}

