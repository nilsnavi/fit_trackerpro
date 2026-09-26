import { useMutation, useQueryClient } from '@tanstack/react-query'
import { exercisesApi } from '@shared/api/domains/exercisesApi'

async function invalidateExercisesCatalog(queryClient: ReturnType<typeof useQueryClient>) {
    // Covers both the public catalog and the moderation queue (different `status`).
    await queryClient.invalidateQueries({ queryKey: ['exercises', 'list'] })
}

export function useCreateCustomExerciseMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (formData: FormData) => exercisesApi.createCustom(formData),
        onSuccess: async () => {
            await invalidateExercisesCatalog(queryClient)
        },
    })
}

export function useUpdateExerciseMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ exerciseId, payload }: { exerciseId: number; payload: unknown }) =>
            exercisesApi.update(exerciseId, payload),
        onSuccess: async () => {
            await invalidateExercisesCatalog(queryClient)
        },
    })
}

export function useDeleteExerciseMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (exerciseId: number) => exercisesApi.remove(exerciseId),
        onSuccess: async () => {
            await invalidateExercisesCatalog(queryClient)
        },
    })
}

/** Admin: approve a pending submission. */
export function useApproveExerciseMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (exerciseId: number) => exercisesApi.approve(exerciseId),
        onSuccess: async () => {
            await invalidateExercisesCatalog(queryClient)
        },
    })
}
