import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type {
    WorkoutCompleteRequest,
    WorkoutStartRequest,
    WorkoutTemplateCreateRequest,
} from '@features/workouts/types/workouts'

export type CompleteWorkoutVariables = {
    workoutId: number
    payload: WorkoutCompleteRequest
}

export function useCreateWorkoutTemplateMutation() {
    return useMutation({
        mutationFn: (payload: WorkoutTemplateCreateRequest) =>
            workoutsApi.createTemplate(payload),
    })
}

export function useStartWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: WorkoutStartRequest) => workoutsApi.startWorkout(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['workouts'] })
        },
    })
}

export function useCompleteWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ workoutId, payload }: CompleteWorkoutVariables) =>
            workoutsApi.completeWorkout(workoutId, payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['workouts'] })
        },
    })
}
