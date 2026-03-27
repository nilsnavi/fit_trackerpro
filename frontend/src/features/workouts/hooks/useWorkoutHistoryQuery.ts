import { useQuery } from '@tanstack/react-query'
import { workoutsApi } from '../api/workoutsApi'

export function useWorkoutHistoryQuery() {
    return useQuery({
        queryKey: ['workouts', 'history'],
        queryFn: () => workoutsApi.getHistory({ page: 1, page_size: 50 }),
    })
}
