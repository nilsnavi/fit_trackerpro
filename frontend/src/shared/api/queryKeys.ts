/** Mirrors AchievementCategory | 'all' without importing the achievements feature (keeps queryKeys leaf-only). */
export type AchievementListFilter =
    | 'workouts'
    | 'strength'
    | 'health'
    | 'content'
    | 'general'
    | 'all'

export const queryKeys = {
    profile: {
        me: ['profile', 'me'] as const,
        stats: ['profile', 'stats'] as const,
        coachAccess: ['profile', 'coachAccess'] as const,
    },
    achievements: {
        list: (category: AchievementListFilter) => ['achievements', 'list', category] as const,
        user: ['achievements', 'user'] as const,
    },
    workouts: {
        history: (params: { page: number; page_size: number }) =>
            ['workouts', 'history', params] as const,
        calendar: (year: number, month: number) => ['workouts', 'calendar', year, month] as const,
    },
    health: {
        waterGoal: ['health', 'water', 'goal'] as const,
        waterReminder: ['health', 'water', 'reminder'] as const,
        waterToday: ['health', 'water', 'today'] as const,
        waterStats: (period: string) => ['health', 'water', 'stats', period] as const,
        glucoseStats: (period: string) => ['health', 'glucose', 'stats', period] as const,
        glucoseReadings: (limit: number) => ['health', 'glucose', 'list', limit] as const,
        wellnessByDate: (date: string) => ['health', 'wellness', 'date', date] as const,
        wellnessRecent: (limit: number) => ['health', 'wellness', 'recent', limit] as const,
        wellnessStats: ['health', 'wellness', 'stats'] as const,
    },
    emergency: {
        contacts: ['emergency', 'contacts'] as const,
    },
    exercises: {
        list: (params: { page: number; page_size: number; status: string }) =>
            ['exercises', 'list', params] as const,
    },
} as const
