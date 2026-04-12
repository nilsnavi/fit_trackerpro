import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { api } from '@shared/api/client'

export interface ChallengeListItem {
    id: number
    name: string
    description?: string | null
    status: string
    start_date: string
    end_date: string
    type: string
}

interface ChallengeMyActiveResponse {
    items: ChallengeListItem[]
    total: number
}

interface ChallengeListResponse {
    items: ChallengeListItem[]
    total: number
}

export interface ChallengesDashboardData {
    active: ChallengeListItem[]
    completed: ChallengeListItem[]
}

/**
 * Активные и завершённые челленджи пользователя (созданные пользователем).
 */
export function useChallenges(): UseQueryResult<ChallengesDashboardData, Error> {
    return useQuery({
        queryKey: queryKeys.challenges.dashboard,
        queryFn: async (): Promise<ChallengesDashboardData> => {
            const [myActive, activeMine, completedMine] = await Promise.all([
                api.get<ChallengeMyActiveResponse>('/analytics/challenges/my/active'),
                api.get<ChallengeListResponse>('/analytics/challenges/', {
                    mine: true,
                    status: 'active',
                    page_size: 30,
                }),
                api.get<ChallengeListResponse>('/analytics/challenges/', {
                    mine: true,
                    status: 'completed',
                    page_size: 30,
                }),
            ])
            const byId = new Map<number, ChallengeListItem>()
            for (const row of [...(myActive.items ?? []), ...(activeMine.items ?? [])]) {
                byId.set(row.id, row)
            }
            return {
                active: [...byId.values()],
                completed: completedMine.items ?? [],
            }
        },
        staleTime: 60_000,
    })
}
