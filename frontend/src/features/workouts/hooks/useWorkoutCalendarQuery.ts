import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'

/** @param monthIndex 0-based month (Date.getMonth()) */
export function useWorkoutCalendarQuery(year: number, monthIndex: number) {
    return useQuery({
        queryKey: queryKeys.workouts.calendar(year, monthIndex),
        queryFn: () =>
            workoutsApi.getCalendarMonth({
                year,
                month: monthIndex + 1,
            }),
    })
}
