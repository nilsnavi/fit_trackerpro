import { api } from '@shared/api/client'
import type { CoachAccess, UserStats } from '@features/profile/types/profile'

export const usersApi = {
    getStats(): Promise<UserStats> {
        return api.get<UserStats>('/users/stats')
    },
    getCoachAccess(): Promise<CoachAccess[]> {
        return api.get<CoachAccess[]>('/users/coach-access')
    },
    generateCoachAccess(): Promise<{ code: string; expires_at: string }> {
        return api.post<{ code: string; expires_at: string }>('/users/coach-access/generate')
    },
    revokeCoachAccess(accessId: string) {
        return api.delete(`/users/coach-access/${accessId}`)
    },
    exportData() {
        return api.get<Blob>('/users/export')
    },
}
