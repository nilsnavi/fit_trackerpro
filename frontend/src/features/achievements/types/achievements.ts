/** Сущности API и UI для достижений (единый источник для api, хуков и компонентов). */

export type AchievementCategory =
    | 'workouts'
    | 'strength'
    | 'health'
    | 'content'
    | 'general'

export interface Achievement {
    id: number
    code: string
    name: string
    description: string
    icon_url?: string
    condition: {
        type: string
        value: number
        description?: string
    }
    points: number
    category: AchievementCategory
    is_hidden: boolean
    display_order: number
    created_at: string
}

export interface UserAchievement {
    id: number
    user_id: number
    achievement_id: number
    achievement: Achievement
    earned_at: string
    progress: number
    progress_data: Record<string, unknown>
    is_completed: boolean
}

export interface UserAchievementStats {
    items: UserAchievement[]
    total: number
    total_points: number
    completed_count: number
    in_progress_count: number
    recent_achievements: UserAchievement[]
}

export interface AchievementUnlockData {
    unlocked: boolean
    achievement?: Achievement
    points_earned: number
    new_total_points: number
    message: string
}
