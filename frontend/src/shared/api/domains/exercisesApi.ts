import { api } from '@shared/api/client'
import type { ExerciseListApiResponse } from '@features/exercises/types/exerciseApi'
import type {
    ExerciseCategoriesApiResponse,
    ExerciseEquipmentListApiResponse,
    ExerciseMuscleGroupsApiResponse,
} from '@features/exercises/types/referenceApi'

export const exercisesApi = {
    list(params?: Record<string, unknown>): Promise<ExerciseListApiResponse> {
        return api.get<ExerciseListApiResponse>('/exercises', params)
    },
    /** Multipart custom exercise (same URL as AddExercise form). */
    createCustom(formData: FormData) {
        return api.post<unknown>('/exercises/custom', formData)
    },
    getById(exerciseId: number) {
        return api.get(`/exercises/${exerciseId}`)
    },
    create(payload: unknown) {
        return api.post('/exercises', payload)
    },
    update(exerciseId: number, payload: unknown) {
        return api.put(`/exercises/${exerciseId}`, payload)
    },
    remove(exerciseId: number) {
        return api.delete(`/exercises/${exerciseId}`)
    },
    categories() {
        return api.get<ExerciseCategoriesApiResponse>('/exercises/categories/list')
    },
    equipment() {
        return api.get<ExerciseEquipmentListApiResponse>('/exercises/equipment/list')
    },
    muscleGroups() {
        return api.get<ExerciseMuscleGroupsApiResponse>('/exercises/muscle-groups/list')
    },
}
