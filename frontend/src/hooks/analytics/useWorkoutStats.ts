import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useProfile } from '@features/profile/hooks/useProfile'
import { analyticsApi } from '@shared/api/domains/analyticsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { ANALYTICS_STALE_MS } from './constants'
import type { AnalyticsPagePeriod, AnalyticsWorkoutStatsResponse } from './types'
import { toApiWorkoutPeriod } from './types'

export function useWorkoutStats(period: AnalyticsPagePeriod) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const { profile } = useProfile()
    const userId = profile?.id ?? null
    const apiPeriod = toApiWorkoutPeriod(period)

    return useQuery({
        queryKey: queryKeys.analytics.workouts(apiPeriod, userId),
        queryFn: () =>
            analyticsApi.getWorkoutStats({ period: apiPeriod }) as Promise<AnalyticsWorkoutStatsResponse>,
        staleTime: ANALYTICS_STALE_MS,
        enabled: isAuthenticated,
    })
}
