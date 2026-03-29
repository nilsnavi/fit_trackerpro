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
        return api.get<AchievementsListResponse>('/achievements', params)
    },
    getUserAchievements(): Promise<UserAchievementStats> {
        return api.get<UserAchievementStats>('/achievements/user')
    },
    claim(achievementId: number): Promise<AchievementUnlockData> {
        return api.post<AchievementUnlockData>(`/achievements/${achievementId}/claim`)
    },
    checkProgress(): Promise<void> {
        return api.post('/achievements/check-progress')
    },
    getLeaderboard() {
        return api.get('/achievements/leaderboard')
    },
}
