import { useMemo } from 'react'
import type { CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'

export interface GhostModeDataParams {
    /** Текущая тренировка */
    workout: WorkoutHistoryItem | undefined
    /** История тренировок */
    historyItems: WorkoutHistoryItem[] | undefined
    /** ID текущего упражнения */
    exerciseId: number | null
    /** Название текущего упражнения */
    exerciseName: string
    /** Номер текущего подхода */
    setNumber: number
}

export interface GhostModeSetData {
    /** Вес из предыдущего выполнения */
    weight?: number
    /** Повторения из предыдущего выполнения */
    reps?: number
    /** RPE из предыдущего выполнения */
    rpe?: number
    /** Длительность (для cardio/time-based) */
    duration?: number
    /** Дистанция (для cardio) */
    distance?: number
    /** Фактическое время отдыха */
    restSeconds?: number
    /** Дата предыдущего выполнения */
    performedAt?: string
}

export interface GhostModeDataResult {
    /** Данные Ghost Mode для текущего подхода */
    ghostSet: GhostModeSetData | null
    /** Есть ли данные для отображения */
    hasGhostData: boolean
    /** Тип упражнения для контекста */
    exerciseType: 'strength' | 'cardio' | 'time-based' | 'unknown'
}

/**
 * Хук для получения данных Ghost Mode — предыдущих показателей упражнения.
 * Использует историю тренировок для поиска предыдущих выполнений.
 */
export function useGhostModeData({
    workout,
    historyItems,
    exerciseId,
    exerciseName,
    setNumber,
}: GhostModeDataParams): GhostModeDataResult {
    const ghostSet = useMemo(() => {
        if (!historyItems || !exerciseId || !exerciseName || setNumber < 1) {
            return null
        }

        // Ищем предыдущее выполнение того же упражнения
        // Приоритет: то же упражнение в той же позиции подхода
        const previousPerformances: Array<{
            set: CompletedSet
            date: string
        }> = []

        historyItems
            .filter((item) => item.id !== workout?.id)
            .forEach((item) => {
                const exercise = item.exercises.find(
                    (ex) => ex.exercise_id === exerciseId || ex.name === exerciseName,
                )
                if (!exercise) return

                // Берём подход с тем же номером
                const targetSet = exercise.sets_completed.find((s) => s.set_number === setNumber)
                if (targetSet && targetSet.completed) {
                    previousPerformances.push({
                        set: targetSet,
                        date: item.date,
                    })
                }
            })

        if (previousPerformances.length === 0) return null

        // Сортируем по дате (новые первые) и берём последнее
        previousPerformances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const lastPerformance = previousPerformances[0]

        return {
            weight: lastPerformance.set.weight,
            reps: lastPerformance.set.reps,
            rpe: lastPerformance.set.rpe,
            duration: lastPerformance.set.duration,
            distance: lastPerformance.set.distance,
            restSeconds: lastPerformance.set.actual_rest_seconds ?? lastPerformance.set.rest_seconds,
            performedAt: lastPerformance.date,
        }
    }, [historyItems, workout?.id, exerciseId, exerciseName, setNumber])

    const exerciseType = useMemo((): GhostModeDataResult['exerciseType'] => {
        if (!ghostSet) return 'unknown'
        if (ghostSet.duration != null || ghostSet.distance != null) return 'cardio'
        if (ghostSet.weight != null || ghostSet.reps != null) return 'strength'
        return 'unknown'
    }, [ghostSet])

    return {
        ghostSet,
        hasGhostData: ghostSet != null,
        exerciseType,
    }
}

/**
 * Сравнивает текущий подход с Ghost и определяет прогресс.
 */
export function compareWithGhost(
    current: Partial<CompletedSet>,
    ghost: GhostModeSetData | null,
): 'progress' | 'same' | 'regress' | 'unknown' {
    if (!ghost) return 'unknown'

    const currentWeight = current.weight ?? 0
    const ghostWeight = ghost.weight ?? 0
    const currentReps = current.reps ?? 0
    const ghostReps = ghost.reps ?? 0
    const currentDuration = current.duration ?? 0
    const ghostDuration = ghost.duration ?? 0

    // Strength: вес > повторения
    if (currentWeight > ghostWeight) return 'progress'
    if (currentWeight < ghostWeight) return 'regress'
    if (currentWeight === ghostWeight) {
        if (currentReps > ghostReps) return 'progress'
        if (currentReps < ghostReps) return 'regress'
        return 'same'
    }

    // Cardio: дистанция > время
    if (currentDuration > ghostDuration) return 'progress'
    if (currentDuration < ghostDuration) return 'regress'

    return 'same'
}
