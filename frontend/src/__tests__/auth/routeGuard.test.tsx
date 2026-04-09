import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@shared/auth/ProtectedRoute'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { useAuthStore } from '@/stores/authStore'

describe('ProtectedRoute', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
    })

    it('renders children when authenticated', () => {
        useAuthStore.getState().setTokens({ accessToken: 'tok123' })

        render(
            <MemoryRouter initialEntries={['/secret']}>
                <Routes>
                    <Route
                        path="/secret"
                        element={
                            <ProtectedRoute>
                                <div>SECRET CONTENT</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/login" element={<div>LOGIN</div>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('SECRET CONTENT')).toBeInTheDocument()
        expect(screen.queryByText('LOGIN')).toBeNull()
    })

    it('redirects to /login with return URL when not authenticated', () => {
        render(
            <MemoryRouter initialEntries={['/secret?tab=1']}>
                <Routes>
                    <Route
                        path="/secret"
                        element={
                            <ProtectedRoute>
                                <div>SECRET</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/login" element={<div>LOGIN PAGE</div>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
        expect(screen.queryByText('SECRET')).toBeNull()
    })
})

describe('RouteGuard', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
    })

    it('isPublic bypasses auth check', () => {
        render(
            <MemoryRouter initialEntries={['/public']}>
                <Routes>
                    <Route
                        path="/public"
                        element={
                            <RouteGuard isPublic>
                                <div>PUBLIC</div>
                            </RouteGuard>
                        }
                    />
                    <Route path="/login" element={<div>LOGIN</div>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('PUBLIC')).toBeInTheDocument()
    })

    it('protected route redirects without auth', async () => {
        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route
                        path="/protected"
                        element={
                            <RouteGuard>
                                <div>PROTECTED</div>
                            </RouteGuard>
                        }
                    />
                    <Route path="/login" element={<div>LOGIN</div>} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() => {
            expect(screen.getByText('LOGIN')).toBeInTheDocument()
        })
        expect(screen.queryByText('PROTECTED')).toBeNull()
    })

    it('protected route renders with auth', () => {
        useAuthStore.getState().setTokens({ accessToken: 'tok' })

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route
                        path="/protected"
                        element={
                            <RouteGuard>
                                <div>GUARDED</div>
                            </RouteGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('GUARDED')).toBeInTheDocument()
    })
})
