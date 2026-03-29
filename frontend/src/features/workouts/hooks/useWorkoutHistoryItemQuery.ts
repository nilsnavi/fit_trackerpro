import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'

export function useWorkoutHistoryItemQuery(workoutId: number, enabled = true) {
    return useQuery({
        queryKey: queryKeys.workouts.historyItem(workoutId),
        queryFn: () => workoutsApi.getHistoryItem(workoutId),
        enabled,
    })
}
