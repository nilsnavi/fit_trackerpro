import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { analyticsApi } from '@shared/api/domains/analyticsApi'
import type { CalendarWorkout } from '@features/workouts/types/workouts'
import type { WorkoutCalendarResponseApi } from '@features/workouts/types/workoutCalendarApi'

/** @param monthIndex 0-based month (Date.getMonth()) */
export function useWorkoutCalendarQuery(year: number, monthIndex: number) {
    return useQuery({
        queryKey: queryKeys.workouts.calendar(year, monthIndex),
        queryFn: async (): Promise<CalendarWorkout[]> => {
            const resp = await analyticsApi.getCalendar({
                year,
                month: monthIndex + 1,
            })

            const calendar = resp as WorkoutCalendarResponseApi
            const items: CalendarWorkout[] = []

            for (const day of calendar.days ?? []) {
                if (!day?.has_workout) continue
                const workoutType = (day.workout_types?.[0] ?? 'strength') as CalendarWorkout['type']
            const ymd = Number((day.date ?? '').replace(/-/g, ''))
                items.push({
                    id: Number.isFinite(ymd) ? ymd : Math.floor(Math.random() * 1_000_000_000),
                    title: day.workout_count > 0 ? `Тренировок: ${day.workout_count}` : 'Тренировка',
                    type: workoutType,
                    status: 'completed',
                    duration_minutes: Math.max(0, Math.round((day.total_duration ?? 0) / 60)),
                    calories_burned: undefined,
                    scheduled_at: day.date,
                    completed_at: undefined,
                })
            }

            return items
        },
    })
}
