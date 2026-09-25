import { api } from '@shared/api/client'
import type { UserStats } from '@features/profile/types/profile'

export const usersApi = {
    getStats(): Promise<UserStats> {
        return api.get<UserStats>('/users/stats')
    },
    /**
     * Permanently deletes the account and all server-side data (`DELETE /users/me`,
     * 204). Related rows are removed by `ON DELETE CASCADE`.
     */
    deleteAccount(): Promise<void> {
        return api.delete<void>('/users/me')
    },
    /**
     * Full JSON export as a file. `responseType: 'blob'` is required: the backend
     * answers `application/json`, and axios would otherwise parse it into a plain
     * object that `URL.createObjectURL` rejects.
     */
    exportData(): Promise<Blob> {
        return api.get<Blob>('/users/export', undefined, { responseType: 'blob', timeout: 60_000 })
    },
}
