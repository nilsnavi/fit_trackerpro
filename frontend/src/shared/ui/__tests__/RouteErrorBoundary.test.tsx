import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RouteErrorBoundary } from '../RouteErrorBoundary'

// Mock @sentry/react so ErrorBoundary calls the fallback prop with controlled props.
jest.mock('@sentry/react', () => ({
    ErrorBoundary: ({
        children,
        fallback,
    }: {
        children: React.ReactNode
        fallback: (props: {
            error: unknown
            componentStack: string
            eventId: string
            resetError: () => void
        }) => React.ReactNode
        showDialog?: boolean
    }) => {
        const [hasError, setHasError] = React.useState(false)

        if (hasError) {
            return fallback({
                error: new Error('Test error'),
                componentStack: '\n  at Child',
                eventId: 'evt-abc-123',
                resetError: () => setHasError(false),
            })
        }

        // Wrap children; child can throw to trigger fallback in tests.
        return (
            <div>
                <button data-testid="trigger-error" onClick={() => setHasError(true)} />
                {children}
            </div>
        )
    },
}))

function renderBoundary(props: { screenTitle?: string } = {}) {
    return render(
        <MemoryRouter>
            <RouteErrorBoundary {...props}>
                <div data-testid="child-content">Child Content</div>
            </RouteErrorBoundary>
        </MemoryRouter>,
    )
}

describe('RouteErrorBoundary', () => {
    it('renders children when there is no error', () => {
        renderBoundary()
        expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    it('renders fallback UI when error is triggered', () => {
        renderBoundary()
        fireEvent.click(screen.getByTestId('trigger-error'))
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Не удалось открыть экран')).toBeInTheDocument()
    })

    it('fallback contains "Повторить" and "На главную" buttons', () => {
        renderBoundary()
        fireEvent.click(screen.getByTestId('trigger-error'))
        expect(screen.getByText('Повторить')).toBeInTheDocument()
        expect(screen.getByText('На главную')).toBeInTheDocument()
    })

    it('displays screenTitle when provided', () => {
        renderBoundary({ screenTitle: 'Аналитика' })
        fireEvent.click(screen.getByTestId('trigger-error'))
        expect(screen.getByText('Аналитика')).toBeInTheDocument()
    })

    it('displays eventId when non-empty', () => {
        renderBoundary()
        fireEvent.click(screen.getByTestId('trigger-error'))
        expect(screen.getByTestId('route-error-event-id')).toHaveTextContent('evt-abc-123')
    })
})
