import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ExerciseMetrics } from './ExerciseMetrics'

const createMockQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
})

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = createMockQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                {ui}
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('ExerciseMetrics', () => {
    it('renders all metrics correctly', () => {
        renderWithProviders(
            <ExerciseMetrics
                bestWeight={100}
                bestVolume={5000}
                avgWeight={85}
                totalExecutions={45}
            />
        )

        expect(screen.getByText('Лучший вес')).toBeInTheDocument()
        expect(screen.getByText('100')).toBeInTheDocument()
        expect(screen.getByText('кг')).toBeInTheDocument()

        expect(screen.getByText('Лучший объём')).toBeInTheDocument()
        expect(screen.getByText('5.0т')).toBeInTheDocument()

        expect(screen.getByText('Средний вес')).toBeInTheDocument()
        expect(screen.getByText('85')).toBeInTheDocument()

        expect(screen.getByText('Выполнений')).toBeInTheDocument()
        expect(screen.getByText('45')).toBeInTheDocument()
        expect(screen.getByText('раз')).toBeInTheDocument()
    })

    it('handles null values gracefully', () => {
        renderWithProviders(
            <ExerciseMetrics
                bestWeight={null}
                bestVolume={null}
                avgWeight={null}
                totalExecutions={0}
            />
        )

        expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    it('formats volume correctly for small values', () => {
        renderWithProviders(
            <ExerciseMetrics
                bestWeight={50}
                bestVolume={500}
                avgWeight={45}
                totalExecutions={10}
            />
        )

        expect(screen.getByText('500')).toBeInTheDocument()
    })

    it('formats volume correctly for large values', () => {
        renderWithProviders(
            <ExerciseMetrics
                bestWeight={120}
                bestVolume={12000}
                avgWeight={100}
                totalExecutions={30}
            />
        )

        expect(screen.getByText('12.0т')).toBeInTheDocument()
    })
})
