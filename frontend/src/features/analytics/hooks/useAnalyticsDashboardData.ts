import { useQuery } from '@tanstack/react-query'
import type { components } from '@shared/api/generated/openapi'
import { queryKeys } from '@shared/api/queryKeys'
import { api } from '@shared/api/client'
import { analyticsApi } from '@shared/api/domains/analyticsApi'
import { achievementsApi } from '@features/achievements/api/achievementsApi'

/** Аналитика на дашборде не требует обновления каждую секунду. */
export const ANALYTICS_DASHBOARD_STALE_MS = 5 * 60 * 1000

export type AnalyticsDashboardPeriod = 'week' | 'month' | 'all'

export type AnalyticsDashboardResponse = components['schemas']['AnalyticsDashboardResponse']

type ChallengeListResponse = components['schemas']['ChallengeListResponse']

export interface AnalyticsDashboardChallengesMine {
    active: components['schemas']['ChallengeResponse'][]
    completed: components['schemas']['ChallengeResponse'][]
}

/** GET /api/v1/analytics/ — сводка для выбранного периода. */
export function useAnalyticsDashboardSummaryQuery(period: AnalyticsDashboardPeriod) {
    return useQuery({
        queryKey: queryKeys.analytics.dashboard(period),
        queryFn: () => analyticsApi.getDashboard({ period }) as Promise<AnalyticsDashboardResponse>,
        staleTime: ANALYTICS_DASHBOARD_STALE_MS,
    })
}

/**
 * Блок «Достижения» (разблокировки с датами).
 * GET /api/v1/analytics/achievements/user — OpenAPI `UserAchievementListResponse` (`UserAchievementStats` в фиче achievements).
 * Каталог определений: GET /api/v1/analytics/achievements/ (`achievementsApi.list`).
 */
export function useAnalyticsDashboardUserAchievementsQuery() {
    return useQuery({
        queryKey: queryKeys.achievements.user,
        queryFn: () => achievementsApi.getUserAchievements(),
        staleTime: ANALYTICS_DASHBOARD_STALE_MS,
    })
}

/**
 * GET /api/v1/analytics/challenges/ — два запроса с фильтрами (активные / завершённые), только `mine`.
 */
export function useAnalyticsDashboardChallengesQuery() {
    return useQuery({
        queryKey: queryKeys.analytics.challengesMineDashboard,
        queryFn: async (): Promise<AnalyticsDashboardChallengesMine> => {
            const [activeRes, completedRes] = await Promise.all([
                api.get<ChallengeListResponse>('/analytics/challenges/', {
                    mine: true,
                    status: 'active',
                    page_size: 50,
                }),
                api.get<ChallengeListResponse>('/analytics/challenges/', {
                    mine: true,
                    status: 'completed',
                    page_size: 50,
                }),
            ])
            return {
                active: activeRes.items ?? [],
                completed: completedRes.items ?? [],
            }
        },
        staleTime: ANALYTICS_DASHBOARD_STALE_MS,
    })
}
