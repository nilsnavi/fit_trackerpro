import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { EXERCISES_CATALOG_LIST_PARAMS } from '@features/exercises/constants/catalogQueryParams'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { mapApiExerciseToCatalog } from '@features/exercises/lib/mapApiExerciseToCatalog'
import type { Exercise } from '@features/exercises/types/catalogUi'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'

export function useExercisesCatalogQuery() {
    return useQuery({
        queryKey: queryKeys.exercises.list(EXERCISES_CATALOG_LIST_PARAMS),
        queryFn: async (): Promise<Exercise[]> => {
            const res = await exercisesApi.list({ ...EXERCISES_CATALOG_LIST_PARAMS })
            return res.items.map(mapApiExerciseToCatalog)
        },
        ...offlineListQueryDefaults,
    })
}
