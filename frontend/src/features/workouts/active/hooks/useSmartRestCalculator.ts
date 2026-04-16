import { useMemo } from 'react'
import {
    calculateSmartRest,
    classifyExerciseCategory,
    type ExerciseCategory,
} from '../lib/calculateSmartRest'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'
import type { GhostModeSetData } from './useGhostModeData'

export interface UseSmartRestCalculatorParams {
    /** Название упражнения */
    exerciseName: string
    /** RPE последнего подхода */
    lastRpe?: number
    /** Дефолтный отдых пользователя */
    defaultRestSeconds: number
    /** Ghost данные (содержат previousRest) */
    ghostSet?: GhostModeSetData | null
    /** Тип тренировки */
    workoutType?: BackendWorkoutType
}

export interface SmartRestCalculatorResult {
    /** Рассчитанное время отдыха в секундах */
    smartRestSeconds: number
    /** Категория упражнения */
    exerciseCategory: ExerciseCategory
    /** Использовался ли предыдущий отдых в расчёте */
    usedPreviousRest: boolean
    /** Рекомендация по отдыху в текстовом виде */
    recommendation: string
}

/**
 * Хук для расчёта умного времени отдыха.
 */
export function useSmartRestCalculator({
    exerciseName,
    lastRpe,
    defaultRestSeconds,
    ghostSet,
    workoutType,
}: UseSmartRestCalculatorParams): SmartRestCalculatorResult {
    const exerciseCategory = useMemo(
        () => classifyExerciseCategory(exerciseName),
        [exerciseName],
    )

    const smartRestSeconds = useMemo(
        () =>
            calculateSmartRest({
                previousRest: ghostSet?.restSeconds,
                rpe: lastRpe,
                exerciseType: exerciseCategory,
                defaultRest: defaultRestSeconds,
                workoutType,
            }),
        [ghostSet?.restSeconds, lastRpe, exerciseCategory, defaultRestSeconds, workoutType],
    )

    const usedPreviousRest = ghostSet?.restSeconds != null && ghostSet.restSeconds > 0

    const recommendation = useMemo(() => {
        if (lastRpe == null) {
            return `Рекомендуемый отдых: ${Math.floor(smartRestSeconds / 60)}:${(smartRestSeconds % 60).toString().padStart(2, '0')}`
        }
        if (lastRpe >= 8) {
            return 'Тяжёлый подход — отдых подольше'
        }
        if (lastRpe <= 5) {
            return 'Лёгкий подход — можно сократить отдых'
        }
        return `Стандартный отдых: ${Math.floor(smartRestSeconds / 60)} мин`
    }, [lastRpe, smartRestSeconds])

    return {
        smartRestSeconds,
        exerciseCategory,
        usedPreviousRest,
        recommendation,
    }
}
