import { api } from '@shared/api/client'

export const authApi = {
    getCurrentUser() {
        return api.get('/auth/me')
    },
    updateCurrentUser(payload: unknown) {
        return api.put('/auth/me', payload)
    },
    refreshToken() {
        return api.post('/auth/refresh')
    },
    logout() {
        return api.post('/auth/logout')
    },
}
