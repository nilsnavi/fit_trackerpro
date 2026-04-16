import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MuscleSignalsCard } from '../MuscleSignalsCard'
import * as analyticsHooks from '@/hooks/analytics'

// Mock the hook
jest.mock('@/hooks/analytics', () => ({
    useMuscleSignals: jest.fn(),
}))

const mockUseMuscleSignals = analyticsHooks.useMuscleSignals as jest.Mock

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('MuscleSignalsCard', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('shows loading skeleton while pending', () => {
        mockUseMuscleSignals.mockReturnValue({
            isPending: true,
            error: null,
            uiData: null,
            refetch: jest.fn(),
        })

        render(<MuscleSignalsCard />, { wrapper: createWrapper() })

        const skeletons = document.querySelectorAll('.animate-pulse')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows empty state when no data available', () => {
        mockUseMuscleSignals.mockReturnValue({
            isPending: false,
            error: null,
            uiData: null,
            refetch: jest.fn(),
        })

        render(<MuscleSignalsCard />, { wrapper: createWrapper() })

        expect(screen.getByText('Баланс в норме')).toBeInTheDocument()
    })

    it('shows signals when data is available', () => {
        mockUseMuscleSignals.mockReturnValue({
            isPending: false,
            error: null,
            uiData: {
                signals: [
                    {
                        muscle_group: 'back',
                        paired_group: 'chest',
                        ratio: 0.75,
                        severity: 'medium',
                        recommendation: 'Добавьте больше тяговых упражнений',
                    },
                ],
                avgRpe7d: 7.5,
                avgRir7d: 2.0,
            },
            refetch: jest.fn(),
        })

        render(<MuscleSignalsCard />, { wrapper: createWrapper() })

        expect(screen.getByText('Спина / Грудь')).toBeInTheDocument()
        expect(screen.getByText('Добавьте больше тяговых упражнений')).toBeInTheDocument()
    })

    it('shows error state on failure', () => {
        mockUseMuscleSignals.mockReturnValue({
            isPending: false,
            error: new Error('Network error'),
            uiData: null,
            refetch: jest.fn(),
        })

        render(<MuscleSignalsCard />, { wrapper: createWrapper() })

        expect(screen.getByText(/Не удалось загрузить данные/)).toBeInTheDocument()
        expect(screen.getByText('Повторить')).toBeInTheDocument()
    })
})
