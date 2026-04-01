import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

import { useCompleteWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { queryKeys } from '@shared/api/queryKeys'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { AppHttpError } from '@shared/errors'

jest.mock('@shared/lib/businessMetrics', () => ({
    trackBusinessMetric: jest.fn(),
}))

jest.mock('@shared/api/domains/workoutsApi', () => {
    return {
        workoutsApi: {
            completeWorkout: jest.fn(),
        },
    }
})

describe('useCompleteWorkoutMutation (offline / recoverable)', () => {
    it('enqueues offline complete and keeps optimistic cache when mutation is queued', async () => {
        const { workoutsApi } = await import('@shared/api/domains/workoutsApi')
        const syncQueue = await import('@shared/offline/syncQueue')

        const enqueueSpy = jest.spyOn(syncQueue, 'enqueueSyncMutation')
        const flushSpy = jest.spyOn(syncQueue, 'requestSyncFlush')

        const workoutId = 555
        const qc = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })

        const draft: WorkoutHistoryItem = {
            id: workoutId,
            date: '2026-03-10',
            duration: undefined,
            exercises: [
                {
                    exercise_id: 1,
                    name: 'Bench Press',
                    sets_completed: [{ set_number: 1, completed: true, reps: 8, weight: 60 }],
                },
            ],
            comments: 'Draft',
            tags: [],
            created_at: '2026-03-10T10:00:00.000Z',
        }

        qc.setQueryData(queryKeys.workouts.historyItem(workoutId), draft)

        ;(workoutsApi.completeWorkout as jest.Mock).mockRejectedValue(
            new AppHttpError({
                status: null,
                code: 'NETWORK_ERROR',
                message: 'Network error — check your connection',
            }),
        )

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        )

        const { result } = renderHook(() => useCompleteWorkoutMutation(), { wrapper })

        const payload = {
            duration: 40,
            exercises: draft.exercises,
            comments: draft.comments,
            tags: draft.tags,
            glucose_before: undefined,
            glucose_after: undefined,
        }

        // Use mutate (not mutateAsync) and then assert side effects; react-query will surface error state.
        result.current.mutate({ workoutId, payload })

        await waitFor(() => {
            expect(enqueueSpy).toHaveBeenCalledTimes(1)
            expect(flushSpy).toHaveBeenCalledTimes(1)
        })

        // With no active observers for historyItem, invalidate onSettled won't refetch and clobber.
        await waitFor(() => {
            const cached = qc.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
            expect(cached?.duration).toBe(40)
        })
    })
})

