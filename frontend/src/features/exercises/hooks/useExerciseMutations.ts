import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { EXERCISES_CATALOG_LIST_PARAMS } from '@features/exercises/constants/catalogQueryParams'
import { exercisesApi } from '@shared/api/domains/exercisesApi'

export function useCreateCustomExerciseMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (formData: FormData) => exercisesApi.createCustom(formData),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.exercises.list(EXERCISES_CATALOG_LIST_PARAMS),
            })
        },
    })
}
