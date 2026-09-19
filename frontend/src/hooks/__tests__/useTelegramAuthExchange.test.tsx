import { act, renderHook, waitFor } from '@testing-library/react'

import { useTelegramAuthExchange } from '@/hooks/useTelegramAuthExchange'
import { AppHttpError } from '@shared/errors'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@shared/api/client', () => ({
    api: {
        post: jest.fn(),
    },
}))

const INIT_DATA = 'query_id=1&user=test&hash=ab'

function tokenResponse(accessToken: string, refreshToken: string | null = null) {
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        is_new_user: false,
        onboarding_required: false,
    }
}

describe('useTelegramAuthExchange', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
        jest.clearAllMocks()
    })

    it('обменивает initData на токены и кладёт их в стор', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock).mockResolvedValue(tokenResponse('access-token', 'refresh-token'))

        const { result } = renderHook(() => useTelegramAuthExchange(INIT_DATA, true))

        expect(result.current.status).toBe('pending')
        await waitFor(() => expect(result.current.status).toBe('ready'))

        expect(api.post).toHaveBeenCalledWith('/users/auth/telegram', { init_data: INIT_DATA })
        expect(useAuthStore.getState().accessToken).toBe('access-token')
        expect(useAuthStore.getState().refreshToken).toBe('refresh-token')
        expect(result.current.authError).toBe(false)
    })

    it('не ходит в сеть без initData и когда обмен выключен', async () => {
        const { api } = await import('@shared/api/client')

        const withoutInitData = renderHook(() => useTelegramAuthExchange('', true))
        const disabled = renderHook(() => useTelegramAuthExchange(INIT_DATA, false))

        expect(withoutInitData.result.current.status).toBe('idle')
        expect(disabled.result.current.status).toBe('idle')
        expect(api.post).not.toHaveBeenCalled()
    })

    it('отличает отказ авторизации от прочих сбоев', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock).mockRejectedValueOnce(
            new AppHttpError({ status: 401, code: 'unauthorized', message: 'Invalid init data' }),
        )

        const rejected = renderHook(() => useTelegramAuthExchange(INIT_DATA, true))
        await waitFor(() => expect(rejected.result.current.status).toBe('error'))
        expect(rejected.result.current.authError).toBe(true)
        expect(rejected.result.current.message).toBe('Invalid init data')

        ;(api.post as jest.Mock).mockRejectedValueOnce(new Error('Network down'))

        const offline = renderHook(() => useTelegramAuthExchange(INIT_DATA, true))
        await waitFor(() => expect(offline.result.current.status).toBe('error'))
        expect(offline.result.current.authError).toBe(false)
        expect(offline.result.current.message).toBeNull()

        // Ответ без access_token — тоже не отказ авторизации, а сбой контракта.
        ;(api.post as jest.Mock).mockResolvedValueOnce({ refresh_token: null })

        const malformed = renderHook(() => useTelegramAuthExchange(INIT_DATA, true))
        await waitFor(() => expect(malformed.result.current.status).toBe('error'))
        expect(malformed.result.current.authError).toBe(false)
        expect(useAuthStore.getState().accessToken).toBeNull()
    })

    it('повторяет обмен после ошибки и очищает её состояние', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock)
            .mockRejectedValueOnce(
                new AppHttpError({ status: 401, code: 'unauthorized', message: 'Invalid init data' }),
            )
            .mockResolvedValueOnce(tokenResponse('ok-token'))

        const { result } = renderHook(() => useTelegramAuthExchange(INIT_DATA, true))
        await waitFor(() => expect(result.current.status).toBe('error'))

        act(() => result.current.retry())
        expect(result.current.status).toBe('pending')

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(api.post).toHaveBeenCalledTimes(2)
        expect(useAuthStore.getState().accessToken).toBe('ok-token')
        expect(result.current.authError).toBe(false)
        expect(result.current.message).toBeNull()
    })
})
