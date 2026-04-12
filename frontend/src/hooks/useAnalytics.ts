import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { analyticsApi } from '@shared/api/domains/analyticsApi'

export type AnalyticsDashboardPeriod = 'week' | 'month' | 'all'

export interface AnalyticsWeeklyChartPoint {
    date: string
    count: number
}

export interface AnalyticsDashboardData {
    period: AnalyticsDashboardPeriod
    total_workouts: number
    total_duration_minutes: number
    avg_duration: number
    workouts_this_week: number
    workouts_this_month: number
    favorite_exercise: string | null
    streak_days: number
    weekly_chart: AnalyticsWeeklyChartPoint[]
}

export function useAnalytics(period: AnalyticsDashboardPeriod): UseQueryResult<AnalyticsDashboardData, Error> {
    return useQuery({
        queryKey: queryKeys.analytics.dashboard(period),
        queryFn: () => analyticsApi.getDashboard({ period }) as Promise<AnalyticsDashboardData>,
        staleTime: 60_000,
    })
}
