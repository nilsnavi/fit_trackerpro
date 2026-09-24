import { api } from '@shared/api/client'
import type { UserStats } from '@features/profile/types/profile'

export const usersApi = {
    getStats(): Promise<UserStats> {
        return api.get<UserStats>('/users/stats')
    },
    exportData() {
        return api.get<Blob>('/users/export')
    },
}
