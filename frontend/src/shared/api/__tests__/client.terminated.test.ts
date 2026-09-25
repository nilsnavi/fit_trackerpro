import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { api } from '@shared/api/client'
import { AppHttpError } from '@shared/errors'
import { useAppTerminationStore } from '@/stores/appTerminationStore'
import { useAuthStore } from '@/stores/authStore'

function unauthorizedAdapter(): jest.MockedFunction<AxiosAdapter> {
    return jest.fn(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
            status: 401,
            statusText: 'Unauthorized',
            data: { detail: 'User not found' },
            headers: {},
            config,
        })
    })
}

describe('api client after account deletion', () => {
    const client = (api as unknown as { client: { defaults: { adapter?: unknown } } }).client

    beforeEach(() => {
        // The client logs API errors; jsdom also reports the /login redirect as "not implemented".
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
        jest.restoreAllMocks()
        sessionStorage.clear()
        useAppTerminationStore.setState({ reason: null })
        delete client.defaults.adapter
    })

    it('does not refresh the session, redirect or re-login on a late 401', async () => {
        const adapter = unauthorizedAdapter()
        client.defaults.adapter = adapter
        useAuthStore.getState().setTokens({ accessToken: 'stale', refreshToken: 'refresh' })
        useAppTerminationStore.getState().terminate('account_deleted')
        const sessionExpired = jest.fn()
        window.addEventListener('auth:session-expired', sessionExpired)

        try {
            await expect(api.get('/users/me')).rejects.toBeInstanceOf(AppHttpError)
        } finally {
            window.removeEventListener('auth:session-expired', sessionExpired)
        }

        // Only the original request — no POST /users/auth/refresh.
        expect(adapter).toHaveBeenCalledTimes(1)
        expect(sessionExpired).not.toHaveBeenCalled()
        expect(sessionStorage.getItem('return_url_after_login')).toBeNull()
    })

    it('still refreshes the session while the app is alive, and fails fast if refresh is rejected', async () => {
        const adapter = unauthorizedAdapter()
        client.defaults.adapter = adapter
        useAuthStore.getState().setTokens({ accessToken: 'stale', refreshToken: 'refresh' })

        // Regression: a 401 from /users/auth/refresh used to deadlock on its own refreshPromise.
        await expect(api.get('/users/me')).rejects.toBeInstanceOf(AppHttpError)

        expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(['/users/me', '/users/auth/refresh'])
        expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
})
