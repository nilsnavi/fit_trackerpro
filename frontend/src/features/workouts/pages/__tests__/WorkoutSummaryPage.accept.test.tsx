/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * SPEC-006 §42/§58: the summary is where the user accepts the next target.
 *
 * Accepting there is what makes the next start of the same template open on the
 * new weight, so the page must send the decision to the API with the
 * recommendation id and its recommended value.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockAccept = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock('@features/workouts/hooks/useWorkoutHistoryItemQuery', () => ({
    useWorkoutHistoryItemQuery: () => ({
        data: {
            id: 7,
            comments: 'Bench day',
            duration: 45,
            exercises: [
                {
                    exercise_id: 1,
                    name: 'Bench Press',
                    sets_completed: [
                        { set_number: 1, reps: 12, weight: 80, completed: true },
                        { set_number: 2, reps: 12, weight: 80, completed: true },
                        { set_number: 3, reps: 12, weight: 80, completed: true },
                    ],
                },
            ],
        },
        isLoading: false,
        isError: false,
        error: null,
    }),
}))

jest.mock('@features/workouts/hooks/useWorkoutHistoryQuery', () => ({
    useWorkoutHistoryQuery: () => ({ data: { items: [] } }),
}))

jest.mock('@features/workouts/active/hooks/useProgressionRecommendation', () => ({
    useAcceptProgressionRecommendation: () => ({ mutate: mockAccept, isPending: false }),
}))

jest.mock('@shared/stores/toastStore', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
        info: jest.fn(),
    },
}))

// jsdom + lucide icons: render placeholder spans instead of SVG icons.
jest.mock('lucide-react', () => {
    const React = require('react')
    const Icon = () => React.createElement('span')
    return new Proxy({}, { get: () => Icon })
})

import { WorkoutSummaryPage } from '../WorkoutSummaryPage'

const RECOMMENDATION = {
    id: 42,
    exercise_id: 1,
    policy: 'DOUBLE_PROGRESSION',
    status: 'INCREASE',
    lifecycle_status: 'generated',
    previous_value: 80,
    recommended_value: 82.5,
    actual_selected_value: null,
    difference: 2.5,
    reason_code: 'REP_RANGE_COMPLETED',
    reason_text: 'Все три рабочих подхода достигли верхней границы 12 повторений.',
    confidence: 'high',
}

function renderPage() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/workouts/active/7/summary',
                        state: { workoutTitle: 'Bench day', progressionRecommendations: [RECOMMENDATION] },
                    },
                ]}
            >
                <Routes>
                    <Route path="/workouts/active/:id/summary" element={<WorkoutSummaryPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    mockAccept.mockReset()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
})

describe('WorkoutSummaryPage next target', () => {
    it('shows the engine reason next to the target', () => {
        renderPage()
        expect(screen.getByText(/REP_RANGE_COMPLETED|верхней границы 12 повторений/)).toBeInTheDocument()
        expect(screen.getByText('82.5 кг')).toBeInTheDocument()
    })

    it('accepts the recommendation with the recommended value', () => {
        renderPage()
        fireEvent.click(screen.getByTestId('summary-accept-target'))

        expect(mockAccept).toHaveBeenCalledTimes(1)
        expect(mockAccept.mock.calls[0][0]).toEqual({ recommendationId: 42, selectedValue: 82.5 })
    })

    it('marks the target as accepted once the decision is stored', async () => {
        mockAccept.mockImplementation((_payload, options) => {
            options?.onSuccess?.({
                ...RECOMMENDATION,
                lifecycle_status: 'accepted',
                actual_selected_value: 82.5,
            })
        })
        renderPage()
        fireEvent.click(screen.getByTestId('summary-accept-target'))

        await waitFor(() => {
            expect(screen.getByTestId('summary-target-decided')).toHaveTextContent('Принято · 82.5 кг')
        })
        expect(screen.getByTestId('summary-target-decided')).toHaveTextContent('подставим в следующую тренировку')
        expect(screen.queryByTestId('summary-accept-target')).not.toBeInTheDocument()
        expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    })

    it('does not offer to accept an already decided target', () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter
                    initialEntries={[
                        {
                            pathname: '/workouts/active/7/summary',
                            state: {
                                progressionRecommendations: [
                                    { ...RECOMMENDATION, lifecycle_status: 'accepted', actual_selected_value: 82.5 },
                                ],
                            },
                        },
                    ]}
                >
                    <Routes>
                        <Route path="/workouts/active/:id/summary" element={<WorkoutSummaryPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        )

        expect(screen.queryByTestId('summary-accept-target')).not.toBeInTheDocument()
        expect(screen.getByTestId('summary-target-decided')).toHaveTextContent('Принято · 82.5 кг')
    })
})
