/**
 * Relative-path redirects in the workouts route table.
 *
 * These routes use `<Navigate to=".." relative="path" />`, the construct most
 * sensitive to router major upgrades (react-router 6 -> 7, WS1-2). The test
 * renders the real route table and asserts which path the redirect resolves to:
 * unauthenticated users are bounced to /login with the resolved path in `from`,
 * which makes the resolution observable without authentication.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { workoutRoutes } from '@features/workouts/routes'
import { useAuthStore } from '@/stores/authStore'

function LoginProbe() {
    const location = useLocation()
    return <div data-testid="login-location">{`${location.pathname}${location.search}`}</div>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {workoutRoutes()}
                <Route path="/login" element={<LoginProbe />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('workouts route table: relative redirects', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
    })

    it('resolves /workouts/:id/edit to the parent workout path', async () => {
        renderAt('/workouts/42/edit')

        await waitFor(() => {
            expect(screen.getByTestId('login-location')).toHaveTextContent(
                '/login?from=%2Fworkouts%2F42',
            )
        })
    })

    it('resolves /workouts/active/:id/edit to the parent active workout path', async () => {
        renderAt('/workouts/active/42/edit')

        await waitFor(() => {
            expect(screen.getByTestId('login-location')).toHaveTextContent(
                '/login?from=%2Fworkouts%2Factive%2F42',
            )
        })
    })

    it('keeps the canonical /workouts/builder -> templates/new redirect', async () => {
        renderAt('/workouts/builder')

        await waitFor(() => {
            expect(screen.getByTestId('login-location')).toHaveTextContent(
                '/login?from=%2Fworkouts%2Ftemplates%2Fnew',
            )
        })
    })
})
