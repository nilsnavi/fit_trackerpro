import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { workoutTemplatesDefaultListParams } from '@features/workouts/lib/workoutQueryOptimistic'

export function useWorkoutTemplatesQuery(enabled = true) {
    const params = workoutTemplatesDefaultListParams
    return useQuery({
        queryKey: queryKeys.workouts.templatesList(params),
        queryFn: () => workoutsApi.getTemplates(params),
        enabled,
    })
}
