import { api } from '@shared/api/client'
import type {
    ExerciseApiItem,
    ExerciseListApiParams,
    ExerciseListApiResponse,
} from '@features/exercises/types/exerciseApi'
import type {
    ExerciseCategoriesApiResponse,
    ExerciseEquipmentListApiResponse,
    ExerciseMuscleGroupsApiResponse,
} from '@features/exercises/types/referenceApi'

export const exercisesApi = {
    list(params?: ExerciseListApiParams): Promise<ExerciseListApiResponse> {
        return api.get<ExerciseListApiResponse>('/exercises', params as Record<string, unknown> | undefined)
    },
    /** Multipart custom exercise (same URL as AddExercise form). */
    createCustom(formData: FormData): Promise<ExerciseApiItem> {
        return api.post<ExerciseApiItem>('/exercises/custom', formData)
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
    getBySlugs(slugs: string[]): Promise<Record<string, number>> {
        return api.get<Record<string, number>>('/exercises/by-slugs', { slugs })
    },
}
