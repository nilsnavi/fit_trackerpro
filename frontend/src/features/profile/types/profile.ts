export interface UserProfile {
    id: number
    telegram_id: number
    username?: string
    first_name?: string
    last_name?: string
    profile: {
        equipment?: string[]
        limitations?: string[]
        goals?: string[]
        current_weight?: number
        target_weight?: number
        height?: number
        birth_date?: string
        fitness_goal?: 'strength' | 'weight_loss' | 'endurance'
        experience_level?: 'beginner' | 'intermediate' | 'advanced'
        onboarding_completed?: boolean
        onboarding_completed_at?: string
        telegram_photo_url?: string
    }
    settings: {
        theme?: string
        notifications?: boolean
        units?: 'metric' | 'imperial'
        language?: string
    }
    /**
     * Server-side admin flag (`ADMIN_USER_IDS` on the backend). Only decides whether
     * moderation controls are shown — every admin endpoint re-checks it.
     */
    is_admin?: boolean
    created_at: string
    updated_at: string
}

export interface UserStats {
    active_days: number
    total_workouts: number
    current_streak: number
    longest_streak: number
    total_duration: number
}


export interface WeightProgress {
    current: number
    target: number
    start: number
    progress: number
    diff: number
    goalDate: Date
}
