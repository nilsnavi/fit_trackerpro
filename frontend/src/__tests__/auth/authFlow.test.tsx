import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { LoginPage } from '@features/auth/pages/LoginPage'
import { ProtectedRoute } from '@shared/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@shared/api/client', () => {
    return {
        api: {
            post: jest.fn(),
        },
    }
})

jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: () => ({
        initData: 'query_id=1&user=%7B%7D&auth_date=1&hash=abc',
        isTelegram: true,
        hapticFeedback: jest.fn(),
    }),
}))

describe('Telegram onboarding/auth flow', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
        jest.restoreAllMocks()
    })

    it('happy path: LoginPage calls telegram auth and stores tokens then redirects', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock).mockResolvedValue({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
        })

        render(
            <MemoryRouter initialEntries={['/login?from=%2Fprofile']}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/profile" element={<div>PROFILE</div>} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: /войти через telegram/i }))

        await waitFor(() => {
            expect(useAuthStore.getState().accessToken).toBe('access-1')
            expect(useAuthStore.getState().refreshToken).toBe('refresh-1')
        })

        await waitFor(() => {
            expect(screen.getByText('PROFILE')).toBeInTheDocument()
        })
    })

    it('unauthorized: ProtectedRoute redirects to /login when no token', async () => {
        render(
            <MemoryRouter initialEntries={['/profile']}>
                <Routes>
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <div>PROFILE</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/login" element={<div>LOGIN</div>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('LOGIN')).toBeInTheDocument()
        expect(screen.queryByText('PROFILE')).toBeNull()
    })
})

