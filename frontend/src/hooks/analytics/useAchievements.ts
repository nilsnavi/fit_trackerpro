import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { achievementsApi } from '@features/achievements/api/achievementsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { ANALYTICS_STALE_MS } from './constants'

/**
 * Разблокировки и прогресс текущего пользователя.
 * GET /api/v1/analytics/achievements/user (JWT определяет пользователя).
 * Каталог определений: GET /api/v1/analytics/achievements/
 */
export function useAchievements() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

    return useQuery({
        queryKey: queryKeys.achievements.user,
        queryFn: () => achievementsApi.getUserAchievements(),
        staleTime: ANALYTICS_STALE_MS,
        enabled: isAuthenticated,
    })
}
