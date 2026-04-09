/**
 * TelegramAuthBootstrapGate unit tests.
 *
 * NOTE: Direct unit-testing of TelegramAuthBootstrapGate is skipped because
 * ts-jest hangs when compiling this component's transitive dependency graph
 * (axios → @sentry/react → …). The component is thoroughly covered by:
 *
 *   - E2E: frontend/e2e/telegram-auth-onboarding.spec.ts
 *   - E2E: frontend/e2e/golden-path.spec.ts
 *
 * The logic it delegates to is unit-tested here:
 *   - authStore.test.ts — token CRUD, isAuthenticated
 *   - routeGuard.test.tsx — ProtectedRoute, RouteGuard
 *   - authFlow.test.tsx — LoginPage happy-path
 *
 * If ts-jest performance is improved (or swapped with SWC/esbuild), these
 * can be re-enabled by importing TelegramAuthBootstrapGate directly.
 */

import { useAuthStore } from '@/stores/authStore'

describe('TelegramAuthBootstrapGate (lightweight unit checks)', () => {
    beforeEach(() => {
        useAuthStore.getState().clear()
    })

    it('auth:session-expired event can be dispatched on window', () => {
        const handler = jest.fn()
        window.addEventListener('auth:session-expired', handler)
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
        expect(handler).toHaveBeenCalledTimes(1)
        window.removeEventListener('auth:session-expired', handler)
    })

    it('dispatchSessionExpired from api client fires the event', async () => {
        // Import the real function
        const { dispatchSessionExpired } = await import('@shared/api/client')

        const handler = jest.fn()
        window.addEventListener('auth:session-expired', handler)
        dispatchSessionExpired()
        expect(handler).toHaveBeenCalledTimes(1)
        window.removeEventListener('auth:session-expired', handler)
    })
})
