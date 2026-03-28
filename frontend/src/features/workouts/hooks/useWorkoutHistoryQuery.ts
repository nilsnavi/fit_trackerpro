import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '../api/workoutsApi'

const historyParams = { page: 1, page_size: 50 } as const

export function useWorkoutHistoryQuery() {
    return useQuery({
        queryKey: queryKeys.workouts.history(historyParams),
        queryFn: () => workoutsApi.getHistory(historyParams),
    })
}
