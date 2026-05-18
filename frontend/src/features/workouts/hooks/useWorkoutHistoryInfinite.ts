import { useInfiniteQuery } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'

export type WorkoutHistoryFilterType = 'all' | 'strength' | 'cardio' | 'flexibility' | 'mixed' | 'custom'
export type WorkoutHistoryDatePreset = 'all' | 'week' | 'month'

interface UseWorkoutHistoryInfiniteParams {
    type?: WorkoutHistoryFilterType
    datePreset?: WorkoutHistoryDatePreset
    pageSize?: number
}

export function useWorkoutHistoryInfinite({
    type = 'all',
    datePreset = 'all',
    pageSize = 20,
}: UseWorkoutHistoryInfiniteParams = {}) {
    return useInfiniteQuery({
        queryKey: ['workouts', 'history', 'infinite', { type, datePreset, page_size: pageSize }],
        queryFn: async ({ pageParam = 1 }) => {
            const params: {
                page: number
                page_size: number
                date_from?: string
                date_to?: string
                workout_type?: string
            } = {
                page: pageParam as number,
                page_size: pageSize,
            }

            // Добавляем фильтр по типу тренировки
            if (type !== 'all') {
                params.workout_type = type
            }

            // Добавляем фильтр по дате
            if (datePreset !== 'all') {
                const now = new Date()
                const toDate = new Date(now)
                const fromDate = new Date(now)

                if (datePreset === 'week') {
                    fromDate.setDate(now.getDate() - 7)
                } else if (datePreset === 'month') {
                    fromDate.setDate(now.getDate() - 30)
                }

                params.date_from = fromDate.toISOString().split('T')[0]
                params.date_to = toDate.toISOString().split('T')[0]
            }

            return workoutsApi.getHistory(params)
        },
        getNextPageParam: (lastPage) => {
            const nextPage = lastPage.page + 1
            const totalPages = Math.ceil(lastPage.total / lastPage.page_size)
            return nextPage <= totalPages ? nextPage : undefined
        },
        initialPageParam: 1,
        ...offlineListQueryDefaults,
    })
}
