import { render, screen } from '@testing-library/react'
import { HealthCheckGate } from '../HealthCheckGate'

// The hook is mocked so the tests can drive readiness/loading states directly.
const healthState = { isReady: true, isLoading: false }

jest.mock('@shared/hooks/useBackendHealth', () => ({
    useBackendHealth: () => healthState,
}))

function renderGate() {
    return render(
        <HealthCheckGate>
            <div>Активная тренировка</div>
        </HealthCheckGate>,
    )
}

describe('HealthCheckGate', () => {
    beforeEach(() => {
        healthState.isReady = true
        healthState.isLoading = false
    })

    it('renders children when the backend is ready', () => {
        renderGate()

        expect(screen.getByText('Активная тренировка')).toBeTruthy()
    })

    it('keeps children mounted while a background health poll is in flight', () => {
        // Regression: the hook re-sets isLoading on every 5s poll. Swapping the app
        // for the loading screen there unmounts the tree and wipes in-progress UI
        // state (SPEC-005 §48), so once the backend was ready children must stay.
        const { rerender } = renderGate()
        expect(screen.getByText('Активная тренировка')).toBeTruthy()

        healthState.isLoading = true
        rerender(
            <HealthCheckGate>
                <div>Активная тренировка</div>
            </HealthCheckGate>,
        )

        expect(screen.getByText('Активная тренировка')).toBeTruthy()
    })

    it('shows the maintenance screen when the backend is down', () => {
        healthState.isReady = false
        healthState.isLoading = false

        renderGate()

        expect(screen.queryByText('Активная тренировка')).toBeNull()
        expect(screen.getByText('Техническое обслуживание')).toBeTruthy()
    })
})
