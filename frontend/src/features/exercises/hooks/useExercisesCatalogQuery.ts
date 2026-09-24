import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { mapApiExerciseToCatalog } from '@features/exercises/lib/mapApiExerciseToCatalog'
import type { Exercise } from '@features/exercises/types/catalogUi'
import type { ExerciseListApiParams } from '@features/exercises/types/exerciseApi'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'

const CATALOG_PAGE_SIZE = 100

export interface ExercisesCatalogQueryOptions {
    /** Search is sent to the API so aliases are searchable without loading the whole catalog. */
    search?: string
    /** A single selected category/equipment can be pushed down to the API. */
    category?: string
    equipment?: string
}

async function fetchCatalogPages(params: ExerciseListApiParams): Promise<Exercise[]> {
    const firstPage = await exercisesApi.list({
        ...params,
        page: 1,
        page_size: CATALOG_PAGE_SIZE,
    })
    const pageSize = firstPage.page_size || CATALOG_PAGE_SIZE
    const pageCount = Math.ceil(firstPage.total / pageSize)

    if (pageCount <= 1) {
        return firstPage.items.map(mapApiExerciseToCatalog)
    }

    // Fetch remaining pages concurrently after the first response tells us the
    // total.  This keeps the catalog complete while respecting the API's 100-row
    // page limit and avoids the old 30-row/tiny-catalog assumption.
    const remainingPages = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) =>
            exercisesApi.list({
                ...params,
                page: index + 2,
                page_size: CATALOG_PAGE_SIZE,
            }),
        ),
    )

    return [firstPage, ...remainingPages]
        .flatMap((page) => page.items)
        .map(mapApiExerciseToCatalog)
}

export function useExercisesCatalogQuery(options: ExercisesCatalogQueryOptions = {}) {
    const search = options.search?.trim() || undefined
    const category = options.category || undefined
    const equipment = options.equipment || undefined
    const params: ExerciseListApiParams = {
        status: 'active',
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
        ...(equipment ? { equipment } : {}),
    }

    return useQuery({
        queryKey: queryKeys.exercises.list({ ...params, page_size: CATALOG_PAGE_SIZE }),
        queryFn: () => fetchCatalogPages(params),
        ...offlineListQueryDefaults,
    })
}
