import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { EXERCISES_CATALOG_LIST_PARAMS } from '@features/exercises/constants/catalogQueryParams'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { mapApiExerciseToCatalog } from '@features/exercises/lib/mapApiExerciseToCatalog'
import type { Exercise } from '@features/exercises/types/catalogUi'
import { OFFLINE_QUERY_CACHE_MAX_AGE_MS } from '@shared/offline/offlineQueryPersist'

export function useExercisesCatalogQuery() {
    return useQuery({
        queryKey: queryKeys.exercises.list(EXERCISES_CATALOG_LIST_PARAMS),
        queryFn: async (): Promise<Exercise[]> => {
            const res = await exercisesApi.list({ ...EXERCISES_CATALOG_LIST_PARAMS })
            return res.items.map(mapApiExerciseToCatalog)
        },
        networkMode: 'offlineFirst',
        gcTime: OFFLINE_QUERY_CACHE_MAX_AGE_MS,
        retry: (failureCount) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return false
            }
            return failureCount < 1
        },
    })
}
