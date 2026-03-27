import { api } from '@/services/api'

export const achievementsApi = {
    list() {
        return api.get('/achievements')
    },
    getUserAchievements() {
        return api.get('/achievements/user')
    },
    claim(achievementId: number) {
        return api.post(`/achievements/${achievementId}/claim`)
    },
    getLeaderboard() {
        return api.get('/achievements/leaderboard')
    },
}
