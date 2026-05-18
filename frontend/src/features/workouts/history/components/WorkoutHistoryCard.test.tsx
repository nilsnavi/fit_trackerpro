import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { WorkoutHistoryCard } from './WorkoutHistoryCard'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

const createMockQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
})

const mockWorkout: WorkoutHistoryItem = {
    id: 1,
    date: '2024-01-15',
    created_at: '2024-01-15T10:00:00Z',
    duration: 45,
    comments: 'Грудь и трицепс',
    tags: ['strength'],
    exercises: [
        {
            exercise_id: 1,
            name: 'Жим лёжа',
            sets_completed: [
                { set_number: 1, weight: 80, reps: 10, completed: true },
                { set_number: 2, weight: 80, reps: 10, completed: true },
                { set_number: 3, weight: 80, reps: 8, completed: true },
            ],
        },
        {
            exercise_id: 2,
            name: 'Отжимания на брусьях',
            sets_completed: [
                { set_number: 1, weight: 0, reps: 12, completed: true },
                { set_number: 2, weight: 0, reps: 10, completed: true },
            ],
        },
    ],
    glucose_before: undefined,
    glucose_after: undefined,
    session_metrics: {
        completed_sets: 5,
        rest_tracked_sets: 5,
        rest_tracking_ratio: 1.0,
        total_rest_seconds: 300,
        avg_rest_seconds: 60,
        avg_rpe: 7,
        avg_rir: undefined,
        volume_per_minute: 200,
        effort_distribution: {
            easy: 0,
            moderate: 0,
            hard: 0,
            maximal: 0,
        },
        fatigue_trend: undefined,
        rest_consistency_score: undefined,
    },
    version: 1,
}

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

describe('WorkoutHistoryCard', () => {
    it('renders workout information correctly', () => {
        const onNavigate = vi.fn()
        const onRepeat = vi.fn()

        renderWithProviders(
            <WorkoutHistoryCard
                workout={mockWorkout}
                onNavigate={onNavigate}
                onRepeat={onRepeat}
            />
        )

        expect(screen.getByText('Грудь и трицепс')).toBeInTheDocument()
        expect(screen.getByText(/15 янв\.?/i)).toBeInTheDocument()
        expect(screen.getByText('45 мин')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument() // подходы
    })

    it('calls onNavigate when card is clicked', () => {
        const onNavigate = vi.fn()
        const onRepeat = vi.fn()

        renderWithProviders(
            <WorkoutHistoryCard
                workout={mockWorkout}
                onNavigate={onNavigate}
                onRepeat={onRepeat}
            />
        )

        fireEvent.click(screen.getByRole('button'))
        expect(onNavigate).toHaveBeenCalledWith(1)
    })

    it('calls onRepeat when repeat button is clicked', () => {
        const onNavigate = vi.fn()
        const onRepeat = vi.fn()

        renderWithProviders(
            <WorkoutHistoryCard
                workout={mockWorkout}
                onNavigate={onNavigate}
                onRepeat={onRepeat}
            />
        )

        const repeatButton = screen.getByText('Повторить тренировку')
        fireEvent.click(repeatButton)
        expect(onRepeat).toHaveBeenCalledWith(mockWorkout)
    })

    it('shows "В процессе" badge for incomplete workout', () => {
        const incompleteWorkout: WorkoutHistoryItem = {
            ...mockWorkout,
            duration: 0,
        }

        const onNavigate = vi.fn()
        const onRepeat = vi.fn()

        renderWithProviders(
            <WorkoutHistoryCard
                workout={incompleteWorkout}
                onNavigate={onNavigate}
                onRepeat={onRepeat}
            />
        )

        expect(screen.getByText('В процессе')).toBeInTheDocument()
    })

    it('does not show repeat button for incomplete workout', () => {
        const incompleteWorkout: WorkoutHistoryItem = {
            ...mockWorkout,
            duration: 0,
        }

        const onNavigate = vi.fn()
        const onRepeat = vi.fn()

        renderWithProviders(
            <WorkoutHistoryCard
                workout={incompleteWorkout}
                onNavigate={onNavigate}
                onRepeat={onRepeat}
            />
        )

        expect(screen.queryByText('Повторить тренировку')).not.toBeInTheDocument()
    })
})
