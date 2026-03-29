import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'

export type WorkoutHistoryItemQueryOptions = {
    /** Не перетирать локальные optimistic-правки рефетчем (активная тренировка). */
    staleWhileEditing?: boolean
}

export function useWorkoutHistoryItemQuery(
    workoutId: number,
    enabled = true,
    options?: WorkoutHistoryItemQueryOptions,
) {
    const staleWhileEditing = options?.staleWhileEditing ?? false
    return useQuery({
        queryKey: queryKeys.workouts.historyItem(workoutId),
        queryFn: () => workoutsApi.getHistoryItem(workoutId),
        ...offlineListQueryDefaults,
        enabled,
        staleTime: staleWhileEditing ? Number.POSITIVE_INFINITY : undefined,
        refetchOnWindowFocus: staleWhileEditing ? false : undefined,
    })
}
