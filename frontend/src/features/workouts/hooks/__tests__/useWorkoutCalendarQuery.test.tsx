import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useWorkoutCalendarQuery } from '../useWorkoutCalendarQuery'
import { analyticsApi } from '@shared/api/domains/analyticsApi'

jest.mock('@shared/api/domains/analyticsApi', () => ({
    analyticsApi: {
        getCalendar: jest.fn(),
    },
}))

describe('useWorkoutCalendarQuery', () => {
    function createWrapper(client: QueryClient) {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return <QueryClientProvider client={client}>{children}</QueryClientProvider>
        }
    }

    it('calls analytics calendar endpoint and maps to CalendarWorkout[]', async () => {
        (analyticsApi.getCalendar as jest.Mock).mockResolvedValue({
            year: 2026,
            month: 4,
            days: [
                {
                    date: '2026-04-01',
                    has_workout: true,
                    workout_count: 2,
                    total_duration: 3600,
                    workout_types: ['strength'],
                    glucose_logged: false,
                    wellness_logged: false,
                },
                {
                    date: '2026-04-02',
                    has_workout: false,
                    workout_count: 0,
                    total_duration: 0,
                    workout_types: [],
                    glucose_logged: false,
                    wellness_logged: false,
                },
            ],
            summary: {
                total_workouts: 2,
                total_duration: 3600,
                active_days: 1,
                rest_days: 29,
            },
        })

        const qc = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })

        const { result } = renderHook(() => useWorkoutCalendarQuery(2026, 3), {
            wrapper: createWrapper(qc),
        })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(analyticsApi.getCalendar).toHaveBeenCalledWith({ year: 2026, month: 4 })

        expect(result.current.data).toEqual([
            expect.objectContaining({
                title: 'Тренировок: 2',
                type: 'strength',
                status: 'completed',
                scheduled_at: '2026-04-01',
            }),
        ])
    })
})

