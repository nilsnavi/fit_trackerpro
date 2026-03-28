import { api } from '@shared/api/client'

export const usersApi = {
    getStats() {
        return api.get('/users/stats')
    },
    getCoachAccess() {
        return api.get('/users/coach-access')
    },
    generateCoachAccess() {
        return api.post('/users/coach-access/generate')
    },
    revokeCoachAccess(accessId: string) {
        return api.delete(`/users/coach-access/${accessId}`)
    },
    exportData() {
        return api.get<Blob>('/users/export')
    },
}
