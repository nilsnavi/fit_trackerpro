import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { TelegramAuthGate } from '@/components/TelegramAuthGate'
import { AppHttpError } from '@shared/errors'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@shared/api/client', () => ({
    api: {
        post: jest.fn(),
    },
}))

function setTelegramWebApp(initData: string, initDataUnsafe: Record<string, unknown> = {}) {
    const webApp = window.Telegram?.WebApp
    if (!webApp) throw new Error('window.Telegram.WebApp is not defined')
    Object.assign(webApp, { initData, initDataUnsafe })
}

describe('TelegramAuthGate', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
        setTelegramWebApp('', {})
        jest.clearAllMocks()
    })

    it('shows stub when initData is empty', () => {
        render(
            <TelegramAuthGate>
                <div data-testid="app">APP</div>
            </TelegramAuthGate>,
        )

        expect(screen.getByRole('heading', { name: /открой в telegram/i })).toBeInTheDocument()
        expect(screen.queryByTestId('app')).toBeNull()
    })

    it('POSTs init_data then stores tokens and renders children', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock).mockResolvedValue({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            is_new_user: false,
            onboarding_required: false,
        })

        setTelegramWebApp('query_id=1&user=test&hash=ab', {
            user: { id: 42, first_name: 'Иван', last_name: 'Петров' },
        })

        render(
            <TelegramAuthGate>
                <div data-testid="app">APP</div>
            </TelegramAuthGate>,
        )

        expect(screen.getByText('Иван Петров')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByTestId('app')).toBeInTheDocument()
        })

        expect(api.post).toHaveBeenCalledWith('/users/auth/telegram', {
            init_data: 'query_id=1&user=test&hash=ab',
        })
        expect(useAuthStore.getState().accessToken).toBe('access-token')
        expect(useAuthStore.getState().refreshToken).toBe('refresh-token')
    })

    it('shows auth error on 401 and retries on button click', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock)
            .mockRejectedValueOnce(
                new AppHttpError({
                    status: 401,
                    code: 'unauthorized',
                    message: 'Invalid init data',
                }),
            )
            .mockResolvedValueOnce({
                access_token: 'ok-token',
                refresh_token: null,
                is_new_user: false,
                onboarding_required: false,
            })

        setTelegramWebApp('bad-init', { user: { first_name: 'Анна' } })

        render(
            <TelegramAuthGate>
                <div data-testid="app">APP</div>
            </TelegramAuthGate>,
        )

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /ошибка авторизации/i })).toBeInTheDocument()
        })

        expect(screen.queryByTestId('app')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: /попробовать снова/i }))

        await waitFor(() => {
            expect(screen.getByTestId('app')).toBeInTheDocument()
        })

        expect(api.post).toHaveBeenCalledTimes(2)
        expect(useAuthStore.getState().accessToken).toBe('ok-token')
    })
})
