import { render, screen } from '@testing-library/react'
import type { BackendHealthStatus } from '@shared/hooks/useBackendHealth'
import { HealthCheckGate } from '../HealthCheckGate'

// The hook is mocked so the tests can drive readiness states directly.
const healthState: { status: BackendHealthStatus } = { status: 'ready' }

jest.mock('@shared/hooks/useBackendHealth', () => ({
    useBackendHealth: () => ({
        status: healthState.status,
        isReady: healthState.status !== 'not_ready',
        isLoading: healthState.status === 'checking',
    }),
}))

// A fresh element per render: React skips re-rendering an identical element, which
// would hide the mocked hook's new state.
const gate = () => (
    <HealthCheckGate>
        <div>Активная тренировка</div>
    </HealthCheckGate>
)

describe('HealthCheckGate', () => {
    beforeEach(() => {
        healthState.status = 'ready'
    })

    it('renders children when the backend is ready', () => {
        render(gate())

        expect(screen.getByText('Активная тренировка')).toBeTruthy()
    })

    it('shows the loading screen only until the first check resolves', () => {
        healthState.status = 'checking'
        const { rerender } = render(gate())
        expect(screen.queryByText('Активная тренировка')).toBeNull()
        expect(screen.getByText('Загрузка...')).toBeTruthy()

        healthState.status = 'ready'
        rerender(gate())
        expect(screen.getByText('Активная тренировка')).toBeTruthy()
    })

    it('keeps children mounted while a background health poll is in flight', () => {
        // Regression: swapping the app for the loading screen on a poll unmounts the
        // tree and wipes in-progress UI state (SPEC-005 §48).
        const { rerender } = render(gate())

        healthState.status = 'checking'
        rerender(gate())

        expect(screen.getByText('Активная тренировка')).toBeTruthy()
    })

    it('shows the maintenance screen when the backend is down at startup', () => {
        healthState.status = 'not_ready'

        render(gate())

        expect(screen.queryByText('Активная тренировка')).toBeNull()
        expect(screen.getByText('Техническое обслуживание')).toBeTruthy()
    })

    it.each<BackendHealthStatus>(['offline', 'unreachable', 'unknown'])(
        'does not block the offline-first app when the probe result is %s',
        (status) => {
            healthState.status = status

            render(gate())

            expect(screen.getByText('Активная тренировка')).toBeTruthy()
            expect(screen.queryByText('Техническое обслуживание')).toBeNull()
        },
    )

    it('shows a non-blocking banner instead of unmounting when an outage starts later', () => {
        const { rerender } = render(gate())

        healthState.status = 'not_ready'
        rerender(gate())

        expect(screen.getByText('Активная тренировка')).toBeTruthy()
        expect(screen.getByTestId('backend-outage-banner')).toBeTruthy()
        expect(screen.queryByText('Техническое обслуживание')).toBeNull()

        healthState.status = 'ready'
        rerender(gate())
        expect(screen.queryByTestId('backend-outage-banner')).toBeNull()
    })
})
