import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useProfile } from '@features/profile/hooks/useProfile'
import { api } from '@shared/api/client'
import { queryKeys } from '@shared/api/queryKeys'
import { ANALYTICS_STALE_MS } from './constants'
import type { AnalyticsChallengesMine, ChallengeListResponse } from './types'

/** Два запроса GET /api/v1/analytics/challenges/ (mine + active / mine + completed). */
export function useChallenges() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const { profile } = useProfile()
    const userId = profile?.id ?? null

    return useQuery({
        queryKey: queryKeys.analytics.challengesMine(userId),
        queryFn: async (): Promise<AnalyticsChallengesMine> => {
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
        staleTime: ANALYTICS_STALE_MS,
        enabled: isAuthenticated,
    })
}
