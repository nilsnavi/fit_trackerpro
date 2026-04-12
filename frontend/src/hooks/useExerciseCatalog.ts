import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { queryKeys } from '@shared/api/queryKeys'
import { OFFLINE_QUERY_CACHE_MAX_AGE_MS } from '@shared/offline/offlineQueryPersist'
import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'
import type { WorkoutBuilderExercise } from '@features/workouts/types/workoutBuilder'

const DEFAULT_LIMIT = 20

function mapApiToBuilderItem(item: ExerciseApiItem): WorkoutBuilderExercise {
    const muscleGroups = item.muscle_groups ?? []
    return {
        id: String(item.id),
        name: item.name,
        category: item.category,
        muscleGroup: item.muscle_group ?? muscleGroups[0] ?? null,
        muscleGroups,
        equipment: item.equipment ?? [],
        aliases: item.aliases ?? [],
    }
}

interface CatalogPage {
    items: WorkoutBuilderExercise[]
    total: number
    page: number
    pageSize: number
}

export interface UseExerciseCatalogOptions {
    /** Поисковая строка (обычно уже debounce на стороне UI). */
    search?: string
    /** Значение фильтра группы мышц; `'all'` — без фильтра. */
    muscleGroup?: string
    /** Категория упражнения; `'all'` — без фильтра. */
    category?: string
    /**
     * Размер страницы. Бэкенд принимает `page` и `page_size` (эквивалент offset = (page-1)*page_size, limit = page_size).
     */
    limit?: number
    enabled?: boolean
}

export interface UseExerciseCatalogResult {
    exercises: WorkoutBuilderExercise[]
    isLoading: boolean
    error: unknown | null
    fetchMore: () => void
    refetch: () => void
    /** Строка поиска, переданная в запросы каталога. */
    search: string
    /** Текущее значение фильтра по группе мышц (как передано в опциях). */
    filterByMuscle: string
    isFetchingNextPage: boolean
    hasNextPage: boolean
}

/**
 * Каталог упражнений для конструкторов тренировок: пагинация, поиск, фильтр по группе мышц.
 * Данные: GET `/api/v1/exercises` через общий `exercisesApi.list` (`page`, `page_size`, `search`, `muscle_group`, …).
 */
export function useExerciseCatalog(options: UseExerciseCatalogOptions): UseExerciseCatalogResult {
    const {
        search = '',
        muscleGroup = 'all',
        category = 'all',
        limit = DEFAULT_LIMIT,
        enabled = true,
    } = options

    const normalizedParams = useMemo(
        () => ({
            status: 'active' as const,
            page_size: limit,
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(muscleGroup !== 'all' && muscleGroup ? { muscle_group: muscleGroup } : {}),
            ...(category !== 'all' && category ? { category } : {}),
        }),
        [search, muscleGroup, category, limit],
    )

    const query = useInfiniteQuery({
        queryKey: queryKeys.exercises.list(normalizedParams as Record<string, unknown>),
        enabled,
        initialPageParam: 1,
        queryFn: async ({ pageParam }): Promise<CatalogPage> => {
            const response = await exercisesApi.list({
                ...normalizedParams,
                page: pageParam,
            })

            return {
                items: response.items.map(mapApiToBuilderItem),
                total: response.total,
                page: response.page,
                pageSize: response.page_size,
            }
        },
        getNextPageParam: (lastPage) => {
            const loaded = lastPage.page * lastPage.pageSize
            return loaded < lastPage.total ? lastPage.page + 1 : undefined
        },
        staleTime: 5 * 60 * 1000,
        gcTime: OFFLINE_QUERY_CACHE_MAX_AGE_MS,
        networkMode: 'offlineFirst',
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: (failureCount) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return false
            }
            return failureCount < 1
        },
    })

    const exercises = useMemo(() => {
        const pages = query.data?.pages ?? []
        const deduped = new Map<string, WorkoutBuilderExercise>()

        for (const page of pages) {
            for (const item of page.items) {
                deduped.set(item.id, item)
            }
        }

        return Array.from(deduped.values())
    }, [query.data])

    const fetchMore = useCallback(() => {
        void query.fetchNextPage()
    }, [query])

    const refetch = useCallback(() => {
        void query.refetch()
    }, [query])

    return {
        exercises,
        isLoading: query.isLoading,
        error: query.isError ? query.error : null,
        fetchMore,
        refetch,
        search: search.trim(),
        filterByMuscle: muscleGroup,
        isFetchingNextPage: query.isFetchingNextPage,
        hasNextPage: Boolean(query.hasNextPage),
    }
}
