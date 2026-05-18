import { useQuery } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type { WorkoutHistoryItem, CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import { useMemo } from 'react'

export interface ExerciseProgressData {
    exerciseId: number
    exerciseName: string
    dates: string[]
    weights: (number | null)[]
    volumes: (number | null)[]
    reps: (number | null)[]
    sets: number[]
    bestWeight: number | null
    bestVolume: number | null
    avgWeight: number | null
    totalExecutions: number
}

export interface UseExerciseProgressParams {
    exerciseId: number | null
    dateFrom?: string | null
    dateTo?: string | null
}

/**
 * Хук для получения прогресса по конкретному упражнению из завершенных тренировок
 */
export function useExerciseProgress({ exerciseId, dateFrom, dateTo }: UseExerciseProgressParams) {
    // Получаем историю тренировок
    const historyQuery = useQuery({
        queryKey: ['exercise-progress', exerciseId, dateFrom, dateTo],
        queryFn: async () => {
            if (!exerciseId) return []
            
            // Загружаем все тренировки за период
            const response = await workoutsApi.getHistory({
                page: 1,
                page_size: 200, // Берем больше данных для полного анализа
                date_from: dateFrom ?? undefined,
                date_to: dateTo ?? undefined,
            })
            
            return response.items
        },
        enabled: !!exerciseId,
        staleTime: 60_000, // 1 минута
    })

    // Обрабатываем данные и вычисляем метрики
    const progressData = useMemo<ExerciseProgressData | null>(() => {
        if (!exerciseId || !historyQuery.data) return null

        const workouts = historyQuery.data
        
        // Собираем все подходы по этому упражнению из всех тренировок
        interface SetDataPoint {
            date: string
            weight: number | null
            reps: number | null
            volume: number | null
        }

        const dataPoints: SetDataPoint[] = []
        
        workouts.forEach((workout: WorkoutHistoryItem) => {
            const exercise = workout.exercises?.find(
                (ex: CompletedExercise) => ex.exercise_id === exerciseId
            )
            
            if (!exercise) return
            
            exercise.sets_completed?.forEach((set: CompletedSet) => {
                if (!set.completed) return
                
                const weight = set.weight ?? null
                const reps = set.reps ?? null
                const volume = weight && reps ? weight * reps : null
                
                dataPoints.push({
                    date: workout.date,
                    weight,
                    reps,
                    volume,
                })
            })
        })

        // Сортируем по дате
        dataPoints.sort((a, b) => a.date.localeCompare(b.date))

        // Группируем по датам для графиков
        const groupedByDate = new Map<string, {
            maxWeight: number | null
            totalVolume: number
            totalSets: number
            weights: number[]
        }>()

        dataPoints.forEach((point) => {
            const existing = groupedByDate.get(point.date)
            if (!existing) {
                groupedByDate.set(point.date, {
                    maxWeight: point.weight,
                    totalVolume: point.volume ?? 0,
                    totalSets: 1,
                    weights: point.weight ? [point.weight] : [],
                })
            } else {
                if (point.weight !== null) {
                    existing.weights.push(point.weight)
                    existing.maxWeight = existing.maxWeight === null 
                        ? point.weight 
                        : Math.max(existing.maxWeight, point.weight)
                }
                existing.totalVolume += point.volume ?? 0
                existing.totalSets += 1
            }
        })

        // Создаем массивы для графиков
        const dates: string[] = []
        const weights: (number | null)[] = []
        const volumes: (number | null)[] = []
        const reps: (number | null)[] = []
        const sets: number[] = []
        
        let bestWeight: number | null = null
        let bestVolume: number | null = null
        let totalWeight = 0
        let weightCount = 0
        let totalExecutions = 0

        groupedByDate.forEach((data, date) => {
            dates.push(date)
            weights.push(data.maxWeight)
            volumes.push(data.totalVolume > 0 ? data.totalVolume : null)
            sets.push(data.totalSets)
            
            // Для reps берем средний показатель за день
            const dayReps = dataPoints.filter(p => p.date === date && p.reps !== null)
            const avgReps = dayReps.length > 0 
                ? dayReps.reduce((sum, p) => sum + (p.reps ?? 0), 0) / dayReps.length
                : null
            reps.push(avgReps !== null ? Math.round(avgReps) : null)
            
            // Обновляем лучшие показатели
            if (data.maxWeight !== null) {
                bestWeight = bestWeight === null ? data.maxWeight : Math.max(bestWeight, data.maxWeight)
                totalWeight += data.maxWeight
                weightCount += 1
            }
            if (data.totalVolume > 0) {
                bestVolume = bestVolume === null ? data.totalVolume : Math.max(bestVolume, data.totalVolume)
            }
            
            totalExecutions += data.totalSets
        })

        const avgWeight = weightCount > 0 ? totalWeight / weightCount : null

        return {
            exerciseId,
            exerciseName: '', // Будет заполнено отдельно
            dates,
            weights,
            volumes,
            reps,
            sets,
            bestWeight,
            bestVolume,
            avgWeight,
            totalExecutions,
        }
    }, [exerciseId, historyQuery.data])

    return {
        ...progressData,
        isLoading: historyQuery.isLoading,
        isError: historyQuery.isError,
        error: historyQuery.error,
        refetch: historyQuery.refetch,
    }
}

/**
 * Хук для получения списка всех упражнений из истории тренировок
 */
export function useExercisesList(dateFrom?: string | null, dateTo?: string | null) {
    const historyQuery = useQuery({
        queryKey: ['exercises-list', dateFrom, dateTo],
        queryFn: async () => {
            const response = await workoutsApi.getHistory({
                page: 1,
                page_size: 200,
                date_from: dateFrom ?? undefined,
                date_to: dateTo ?? undefined,
            })
            
            // Собираем уникальные упражнения
            const exercisesMap = new Map<number, { id: number; name: string }>()
            
            response.items.forEach((workout: WorkoutHistoryItem) => {
                workout.exercises?.forEach((exercise: CompletedExercise) => {
                    if (!exercisesMap.has(exercise.exercise_id)) {
                        exercisesMap.set(exercise.exercise_id, {
                            id: exercise.exercise_id,
                            name: exercise.name,
                        })
                    }
                })
            })
            
            return Array.from(exercisesMap.values()).sort((a, b) => 
                a.name.localeCompare(b.name, 'ru')
            )
        },
        staleTime: 60_000,
    })

    return {
        exercises: historyQuery.data ?? [],
        isLoading: historyQuery.isLoading,
        isError: historyQuery.isError,
        error: historyQuery.error,
    }
}
