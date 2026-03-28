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
    }
    settings: {
        theme?: string
        notifications?: boolean
        units?: 'metric' | 'imperial'
        language?: string
    }
    created_at: string
    updated_at: string
}

export interface UserStats {
    active_days: number
    total_workouts: number
    current_streak: number
    longest_streak: number
    total_duration: number
    total_calories: number
}

export interface CoachAccess {
    id: string
    coach_name: string
    created_at: string
    expires_at?: string
}

export interface WeightProgress {
    current: number
    target: number
    start: number
    progress: number
    diff: number
    goalDate: Date
}
