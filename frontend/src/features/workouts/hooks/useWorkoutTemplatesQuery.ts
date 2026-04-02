import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { workoutTemplatesDefaultListParams } from '@features/workouts/lib/workoutQueryOptimistic'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'

interface UseWorkoutTemplatesQueryOptions {
    enabled?: boolean
    includeArchived?: boolean
}

export function useWorkoutTemplatesQuery(options?: UseWorkoutTemplatesQueryOptions) {
    const enabled = options?.enabled ?? true
    const params = {
        ...workoutTemplatesDefaultListParams,
        include_archived: options?.includeArchived ?? false,
    }
    return useQuery({
        queryKey: queryKeys.workouts.templatesList(params),
        queryFn: () => workoutsApi.getTemplates(params),
        ...offlineListQueryDefaults,
        enabled,
    })
}
