import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { analyticsApi } from '@shared/api/domains/analyticsApi'

export type AnalyticsDashboardPeriod = 'week' | 'month' | 'all'

export interface AnalyticsWeeklyChartPoint {
    date: string
    count: number
}

export interface AnalyticsIntensityWeekPoint {
    date: string
    intensity_score: number | null
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
    avg_rpe_per_workout?: number | null
    avg_rpe_previous_period?: number | null
    avg_rpe_trend?: 'up' | 'down' | 'flat' | null
    avg_rest_time_seconds?: number | null
    total_time_under_tension_seconds?: number | null
    intensity_score?: number | null
    intensity_weekly_chart?: AnalyticsIntensityWeekPoint[]
    workouts_with_rpe_count?: number
}

export function useAnalytics(period: AnalyticsDashboardPeriod): UseQueryResult<AnalyticsDashboardData, Error> {
    return useQuery({
        queryKey: queryKeys.analytics.dashboard(period),
        queryFn: () => analyticsApi.getDashboard({ period }) as Promise<AnalyticsDashboardData>,
        staleTime: 60_000,
    })
}
