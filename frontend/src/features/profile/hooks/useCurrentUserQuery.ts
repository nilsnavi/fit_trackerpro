import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { authApi } from '@features/profile/api/authApi'

/** Текущий пользователь с API (тот же кэш, что и в useProfile). */
export function useCurrentUserQuery(enabled = true) {
    return useQuery({
        queryKey: queryKeys.profile.me,
        queryFn: () => authApi.getCurrentUser(),
        enabled,
    })
}
