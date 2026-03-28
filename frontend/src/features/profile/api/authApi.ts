import { api } from '@shared/api/client'
import type { UserProfile } from '@features/profile/types/profile'

export const authApi = {
    getCurrentUser(): Promise<UserProfile> {
        return api.get<UserProfile>('/auth/me')
    },
    updateCurrentUser(payload: unknown): Promise<UserProfile> {
        return api.put<UserProfile>('/auth/me', payload)
    },
    refreshToken() {
        return api.post('/auth/refresh')
    },
    logout() {
        return api.post('/auth/logout')
    },
}
