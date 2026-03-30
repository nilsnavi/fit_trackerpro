import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { exercisesApi } from '@shared/api/domains/exercisesApi'

export function useExerciseCategoriesQuery() {
    return useQuery({
        queryKey: [...queryKeys.exercises.list({ page: 1, page_size: 1, status: 'active' }), 'categories'] as const,
        queryFn: () => exercisesApi.categories(),
        staleTime: 60 * 60 * 1000,
    })
}

export function useExerciseEquipmentQuery() {
    return useQuery({
        queryKey: [...queryKeys.exercises.list({ page: 1, page_size: 1, status: 'active' }), 'equipment'] as const,
        queryFn: () => exercisesApi.equipment(),
        staleTime: 60 * 60 * 1000,
    })
}

export function useExerciseMuscleGroupsQuery() {
    return useQuery({
        queryKey: [...queryKeys.exercises.list({ page: 1, page_size: 1, status: 'active' }), 'muscle_groups'] as const,
        queryFn: () => exercisesApi.muscleGroups(),
        staleTime: 60 * 60 * 1000,
    })
}

