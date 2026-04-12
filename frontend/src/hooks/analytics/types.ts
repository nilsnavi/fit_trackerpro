import type { components } from '@shared/api/generated/openapi'

/** Период на странице аналитики; для API «всё время» передаётся как `all`. */
export type AnalyticsPagePeriod = 'week' | 'month' | 'year'

/** Параметр `period` для GET /api/v1/analytics/workouts (и корня /analytics/). */
export type AnalyticsApiPeriod = 'week' | 'month' | 'all'

export function toApiWorkoutPeriod(period: AnalyticsPagePeriod): AnalyticsApiPeriod {
    return period === 'year' ? 'all' : period
}

export type AnalyticsWorkoutStatsResponse = components['schemas']['AnalyticsDashboardResponse']

type ChallengeListResponse = components['schemas']['ChallengeListResponse']

export interface AnalyticsChallengesMine {
    active: components['schemas']['ChallengeResponse'][]
    completed: components['schemas']['ChallengeResponse'][]
}

export type { ChallengeListResponse }
