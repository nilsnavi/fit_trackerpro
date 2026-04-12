import { api } from '@shared/api/client'
import type {
    Achievement,
    AchievementCategory,
    AchievementUnlockData,
    UserAchievementStats,
} from '@features/achievements/types'

export interface AchievementsListResponse {
    items: Achievement[]
    total: number
    categories: string[]
}

export const achievementsApi = {
    list(params?: { category?: AchievementCategory }): Promise<AchievementsListResponse> {
        return api.get<AchievementsListResponse>('/analytics/achievements/', params)
    },
    getUserAchievements(): Promise<UserAchievementStats> {
        return api.get<UserAchievementStats>('/analytics/achievements/user')
    },
    claim(achievementId: number): Promise<AchievementUnlockData> {
        return api.post<AchievementUnlockData>(`/analytics/achievements/${achievementId}/claim`)
    },
    getLeaderboard() {
        return api.get('/analytics/achievements/leaderboard')
    },
}
