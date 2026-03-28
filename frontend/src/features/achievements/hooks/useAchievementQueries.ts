import { useQuery } from '@tanstack/react-query'
import type { AchievementCategory } from '@features/achievements/components'
import { achievementsApi } from '@features/achievements/api/achievementsApi'
import { queryKeys, type AchievementListFilter } from '@shared/api/queryKeys'

export function useAchievementsListQuery(category: AchievementCategory | 'all') {
    const filter = category as AchievementListFilter
    return useQuery({
        queryKey: queryKeys.achievements.list(filter),
        queryFn: () => achievementsApi.list(category === 'all' ? undefined : { category }),
    })
}

export function useAchievementUserStatsQuery(options?: { refetchInterval?: number | false }) {
    return useQuery({
        queryKey: queryKeys.achievements.user,
        queryFn: () => achievementsApi.getUserAchievements(),
        refetchInterval: options?.refetchInterval,
    })
}
