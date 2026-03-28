import { api } from '@shared/api/client'

export const exercisesApi = {
    list(params?: Record<string, unknown>) {
        return api.get('/exercises', params)
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
}
