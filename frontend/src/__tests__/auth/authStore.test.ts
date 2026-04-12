import { useAuthStore, getAuthTokens } from '@/stores/authStore'

describe('authStore', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
        localStorage.clear()
    })

    it('starts unauthenticated when no legacy tokens', () => {
        const state = useAuthStore.getState()
        expect(state.isAuthenticated).toBe(false)
        expect(state.accessToken).toBeNull()
        expect(state.refreshToken).toBeNull()
    })

    it('setTokens keeps JWT only in memory (does not persist to localStorage)', () => {
        useAuthStore.getState().setTokens({
            accessToken: 'access-abc',
            refreshToken: 'refresh-xyz',
        })

        const state = useAuthStore.getState()
        expect(state.accessToken).toBe('access-abc')
        expect(state.refreshToken).toBe('refresh-xyz')
        expect(state.isAuthenticated).toBe(true)

        expect(localStorage.getItem('auth_token')).toBeNull()
        expect(localStorage.getItem('refresh_token')).toBeNull()
    })

    it('setTokens without refreshToken preserves existing refreshToken', () => {
        useAuthStore.getState().setTokens({
            accessToken: 'a1',
            refreshToken: 'r1',
        })
        useAuthStore.getState().setTokens({
            accessToken: 'a2',
        })

        expect(useAuthStore.getState().accessToken).toBe('a2')
        expect(useAuthStore.getState().refreshToken).toBe('r1')
    })

    it('clear removes tokens from state', () => {
        useAuthStore.getState().setTokens({
            accessToken: 'a',
            refreshToken: 'r',
        })

        useAuthStore.getState().clear()

        const state = useAuthStore.getState()
        expect(state.accessToken).toBeNull()
        expect(state.refreshToken).toBeNull()
        expect(state.isAuthenticated).toBe(false)
    })

    it('getAuthTokens returns current tokens without hooks', () => {
        useAuthStore.getState().setTokens({
            accessToken: 'tok',
            refreshToken: 'ref',
        })

        const { accessToken, refreshToken } = getAuthTokens()
        expect(accessToken).toBe('tok')
        expect(refreshToken).toBe('ref')
    })

    it('isAuthenticated is false when accessToken is empty string', () => {
        useAuthStore.getState().setTokens({
            accessToken: '',
        })

        expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
})
