import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { api } from '@shared/api/client'
import type { UserAchievementStats } from '@features/achievements/types'

/**
 * Достижения текущего пользователя (даты разблокировки) с канонического пути
 * GET /api/v1/analytics/achievements/user
 */
export function useAchievements(): UseQueryResult<UserAchievementStats, Error> {
    return useQuery({
        queryKey: queryKeys.achievements.user,
        queryFn: () => api.get<UserAchievementStats>('/analytics/achievements/user'),
        staleTime: 60_000,
    })
}
