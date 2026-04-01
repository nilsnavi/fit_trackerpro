import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { WorkoutDetailPage } from '@features/workouts/pages/WorkoutDetailPage'
import { queryKeys } from '@shared/api/queryKeys'
import { useWorkoutSessionDraftStore } from '@/stores/workoutSessionDraftStore'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { AppHttpError } from '@shared/errors'

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

    it('opens active draft and allows editing sets: toggle completed + edit reps/weight', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 123
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        // preload so optimistic writes have something to patch immediately
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)

        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        expect(await screen.findByText(/тренировка ещё не завершена/i)).toBeInTheDocument()

        // toggle completion
        const markBtns = await screen.findAllByRole('button', { name: 'Отметить' })
        fireEvent.click(markBtns[0])
        expect((await screen.findAllByRole('button', { name: 'Выполнен' })).length).toBeGreaterThan(0)

        // edit reps/weight (set 1)
        const repsInput = screen.getAllByLabelText('Повторы')[0] as HTMLInputElement
        const weightInput = screen.getAllByLabelText('Вес (кг)')[0] as HTMLInputElement
        fireEvent.change(repsInput, { target: { value: '10' } })
        fireEvent.change(weightInput, { target: { value: '62.5' } })

        await waitFor(() => {
            const cached = qc.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
            expect(cached?.exercises[0].sets_completed[0].reps).toBe(10)
            expect(cached?.exercises[0].sets_completed[0].weight).toBe(62.5)
            expect(cached?.exercises[0].sets_completed[0].completed).toBe(true)
        })
    })

    it('validates completion: blocks when duration is out of range', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 124
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)
        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        await screen.findByText(/тренировка ещё не завершена/i)

        const durationInput = screen
            .getAllByRole('spinbutton')
            .find((el) => el.getAttribute('max') === '1440') as HTMLInputElement
        fireEvent.change(durationInput, { target: { value: '0' } })
        fireEvent.click(screen.getByRole('button', { name: /завершить тренировку/i }))

        expect(await screen.findByText('Укажите длительность от 1 до 1440 минут')).toBeInTheDocument()
    })

    it('validates completion: blocks when workout has no exercises', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 125
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined, exercises: [] })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)
        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        await screen.findByText(/тренировка ещё не завершена/i)
        fireEvent.click(screen.getByRole('button', { name: /завершить тренировку/i }))

        expect(
            await screen.findByText(/добавьте упражнения/i),
        ).toBeInTheDocument()
    })

    it('validates completion: blocks when no completed sets', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 126
        const workout = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(workout)

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), workout)
        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        await screen.findByText(/тренировка ещё не завершена/i)
        fireEvent.click(screen.getByRole('button', { name: /завершить тренировку/i }))

        expect(
            await screen.findByText('Отметьте хотя бы один выполненный подход'),
        ).toBeInTheDocument()
    })

    it('happy path: completes workout, clears draft and updates react-query caches', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const workoutId = 127
        const draft = makeDraftWorkout({ id: workoutId, duration: undefined })
        const qc = makeQueryClient()
        // Keep query refetch from clobbering optimistic/success cache writes in this test:
        // return whatever is currently in cache (falls back to initial draft).
        ;(workoutsApi.getHistoryItem as jest.Mock).mockImplementation(async () => {
            return (
                qc.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId)) ??
                draft
            )
        })
        ;(workoutsApi.completeWorkout as jest.Mock).mockResolvedValue({
            ...draft,
            duration: 50,
            completed_at: '2026-03-10T11:00:00.000Z',
            message: 'ok',
        })

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), draft)
        // Seed related caches to verify patching
        qc.setQueryData(queryKeys.workouts.history({ page: 1, page_size: 10 }), {
            items: [draft],
            total: 1,
            page: 1,
            page_size: 10,
        })
        qc.setQueryData(queryKeys.workouts.calendar(2026, 2), [
            {
                id: workoutId,
                title: 'Draft title',
                type: 'strength',
                status: 'planned',
                duration_minutes: 0,
                scheduled_at: '2026-03-10T10:00:00.000Z',
            },
        ])

        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })

        await screen.findByText(/тренировка ещё не завершена/i)

        // mark set so validation passes
        fireEvent.click((await screen.findAllByRole('button', { name: 'Отметить' }))[0])

        const durationInput = screen
            .getAllByRole('spinbutton')
            .find((el) => el.getAttribute('max') === '1440') as HTMLInputElement
        fireEvent.change(durationInput, { target: { value: '50' } })

        fireEvent.click(screen.getByRole('button', { name: /завершить тренировку/i }))

        await waitFor(() => {
            expect(useWorkoutSessionDraftStore.getState().workoutId).toBeNull()
        })

        await waitFor(() => {
            const item = qc.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
            expect(item?.duration).toBe(50)
        })

        await waitFor(() => {
            const list = qc.getQueryData<any>(queryKeys.workouts.history({ page: 1, page_size: 10 }))
            expect(list?.items?.[0]?.id).toBe(workoutId)
            expect(list?.items?.[0]?.duration).toBe(50)
        })
    })

    it('network error (recoverable): enqueues offline complete (UI shows queued error)', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const syncQueue = await import('@shared/offline/syncQueue')

        const workoutId = 128
        const draft = makeDraftWorkout({ id: workoutId, duration: undefined })
        ;(workoutsApi.getHistoryItem as jest.Mock).mockResolvedValue(draft)

        const enqueueSpy = jest.spyOn(syncQueue, 'enqueueSyncMutation')
        const flushSpy = jest.spyOn(syncQueue, 'requestSyncFlush')

        ;(workoutsApi.completeWorkout as jest.Mock).mockRejectedValue(
            new AppHttpError({
                status: null,
                code: 'NETWORK_ERROR',
                message: 'Network error — check your connection',
            }),
        )

        useWorkoutSessionDraftStore.getState().setDraft(workoutId, 'Draft title')

        const qc = makeQueryClient()
        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), draft)

        renderWorkoutDetailPage({ id: String(workoutId), queryClient: qc })
        await screen.findByText(/тренировка ещё не завершена/i)

        fireEvent.click((await screen.findAllByRole('button', { name: 'Отметить' }))[0])
        fireEvent.click(screen.getByRole('button', { name: /завершить тренировку/i }))

        await waitFor(() => {
            expect(enqueueSpy).toHaveBeenCalledTimes(1)
            expect(flushSpy).toHaveBeenCalledTimes(1)
        })

        expect(await screen.findByText('Mutation queued for offline sync')).toBeInTheDocument()
    })
})

