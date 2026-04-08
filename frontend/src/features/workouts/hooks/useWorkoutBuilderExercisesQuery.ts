import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { queryKeys } from '@shared/api/queryKeys'
import { OFFLINE_QUERY_CACHE_MAX_AGE_MS } from '@shared/offline/offlineQueryPersist'
import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'
import type { WorkoutBuilderExercise } from '@features/workouts/types/workoutBuilder'

const DEFAULT_PAGE_SIZE = 20

interface WorkoutBuilderExercisesQueryParams {
    search?: string
    muscleGroup?: string
    category?: string
    pageSize?: number
}

interface WorkoutBuilderExercisesPage {
    items: WorkoutBuilderExercise[]
    total: number
    page: number
    pageSize: number
}

function mapExerciseToBuilderItem(item: ExerciseApiItem): WorkoutBuilderExercise {
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

export function useWorkoutBuilderExercisesQuery({
    search,
    muscleGroup,
    category,
    pageSize = DEFAULT_PAGE_SIZE,
}: WorkoutBuilderExercisesQueryParams) {
    const normalizedParams = {
        status: 'active' as const,
        page_size: pageSize,
        ...(search ? { search } : {}),
        ...(muscleGroup ? { muscle_group: muscleGroup } : {}),
        ...(category ? { category } : {}),
    }

    const query = useInfiniteQuery({
        queryKey: queryKeys.exercises.list(normalizedParams),
        initialPageParam: 1,
        queryFn: async ({ pageParam }): Promise<WorkoutBuilderExercisesPage> => {
            const response = await exercisesApi.list({
                ...normalizedParams,
                page: pageParam,
            })

            return {
                items: response.items.map(mapExerciseToBuilderItem),
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

    const items = useMemo(() => {
        const pages = query.data?.pages ?? []
        const deduped = new Map<string, WorkoutBuilderExercise>()

        for (const page of pages) {
            for (const item of page.items) {
                deduped.set(item.id, item)
            }
        }

        return Array.from(deduped.values())
    }, [query.data])

    return {
        ...query,
        items,
        total: query.data?.pages[0]?.total ?? 0,
    }
}