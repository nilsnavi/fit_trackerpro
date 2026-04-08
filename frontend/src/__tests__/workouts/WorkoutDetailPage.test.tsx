import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { WorkoutDetailPage } from '@features/workouts/pages/WorkoutDetailPage'
import { queryKeys } from '@shared/api/queryKeys'
import { useWorkoutSessionDraftStore } from '@/stores/workoutSessionDraftStore'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: () => ({
        isTelegram: true,
        hapticFeedback: jest.fn(),
        showBackButton: jest.fn(),
        hideBackButton: jest.fn(),
    }),
}))

jest.mock('@shared/lib/businessMetrics', () => ({
    trackBusinessMetric: jest.fn(),
}))

jest.mock('@shared/api/domains/workoutsApi', () => {
    return {
        workoutsApi: {
            getHistoryItem: jest.fn(),
            completeWorkout: jest.fn(),
        },
    }
})

jest.mock('@features/analytics/api/analyticsDomain', () => ({
    getAnalyticsWorkoutSummary: jest.fn().mockResolvedValue({
        workout_id: 0,
        date: '2026-03-10',
        duration: 0,
        total_sets: 0,
        total_reps: 0,
        total_volume: 0,
        best_sets: [],
        pr_events: [],
    }),
}))

function makeQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
}

function renderWorkoutDetailPage(params: { id: string; queryClient: QueryClient }) {
    const { id, queryClient } = params
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/workouts/${id}`]}>
                <Routes>
                    <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
                    <Route path="/workouts/active/:id" element={<div>Active workout route</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function makeDraftWorkout(params: {
    id: number
    date?: string
    duration?: number | undefined
    exercises?: WorkoutHistoryItem['exercises']
}): WorkoutHistoryItem {
    return {
        id: params.id,
        date: params.date ?? '2026-03-10',
        duration: params.duration,
        exercises:
            params.exercises ??
            [
                {
                    exercise_id: 1,
                    name: 'Bench Press',
                    sets_completed: [
                        { set_number: 1, completed: false, reps: 8, weight: 60 },
                        { set_number: 2, completed: false, reps: 8, weight: 60 },
                    ],
                },
            ],
        comments: 'Draft session',
        tags: [],
        created_at: '2026-03-10T10:00:00.000Z',
    }
}

describe('WorkoutDetailPage (workout session flow)', () => {
    beforeEach(() => {
        useWorkoutSessionDraftStore.getState().clearDraft()
        jest.restoreAllMocks()
    })

    it('shows error for invalid workout id in route params', async () => {
        const qc = makeQueryClient()
        renderWorkoutDetailPage({ id: 'not-a-number', queryClient: qc })
        expect(await screen.findByText('Неверный идентификатор тренировки')).toBeInTheDocument()
    })

    it('shows incomplete workout notice and CTA for active draft', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 123
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        // preload so optimistic writes have something to patch immediately
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)

        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        expect(await screen.findByText(/эта сессия еще не завершена/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /открыть активную тренировку/i })).toBeInTheDocument()
    })

    it('navigates to active workout page from incomplete workout details', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 124
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)
        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        fireEvent.click(await screen.findByRole('button', { name: /открыть активную тренировку/i }))

        expect(await screen.findByText('Active workout route')).toBeInTheDocument()
    })

    it('renders completed workout summary and actions for finished workout', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 125
        const workout = makeDraftWorkout({ id: workoutId, duration: 50 })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)
        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        expect(await screen.findByText('Итоги')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /повторить/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /сохранить как шаблон/i })).toBeInTheDocument()
    })
})

