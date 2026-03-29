import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { usersApi } from '@shared/api/domains/usersApi'

/** Агрегированная статистика пользователя (тот же кэш, что и в useProfile). */
export function useUserStatsQuery(enabled = true) {
    return useQuery({
        queryKey: queryKeys.profile.stats,
        queryFn: () => usersApi.getStats(),
        enabled,
    })
}
