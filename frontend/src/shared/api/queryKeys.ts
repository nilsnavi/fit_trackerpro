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
        historyItem: (workoutId: number) => ['workouts', 'history', 'item', workoutId] as const,
        calendar: (year: number, month: number) => ['workouts', 'calendar', year, month] as const,
        templatesList: (params: { page: number; page_size: number; template_type?: string; include_archived?: boolean }) =>
            ['workouts', 'templates', 'list', params] as const,
        templatesDetail: (templateId: number) => ['workouts', 'templates', 'detail', templateId] as const,
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
        list: (params: Record<string, unknown>) =>
            ['exercises', 'list', params] as const,
    },
    analytics: {
        dashboard: (period: string) => ['analytics', 'dashboard', period] as const,
        /** GET /api/v1/analytics/workouts — период в формате API (week|month|all), userId для ключа кэша */
        workouts: (apiPeriod: string, userId: number | null) =>
            ['analytics', 'workouts', apiPeriod, userId] as const,
        /** Два запроса GET /api/v1/analytics/challenges/ (mine + active/completed) */
        challengesMine: (userId: number | null) => ['analytics', 'challenges', 'mine', userId] as const,
        summary: (period: string, dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'summary', period, dateFrom, dateTo] as const,
        performanceOverview: (period: string, dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'performanceOverview', period, dateFrom, dateTo] as const,
        progress: (
            period: string,
            maxExercises: number,
            maxDataPoints: number,
            dateFrom: string | null,
            dateTo: string | null
        ) => ['analytics', 'progress', period, maxExercises, maxDataPoints, dateFrom, dateTo] as const,
        trainingLoadDaily: (dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'trainingLoadDaily', dateFrom, dateTo] as const,
        trainingLoadDailyTable: (page: number, pageSize: number, dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'trainingLoadDailyTable', page, pageSize, dateFrom, dateTo] as const,
        muscleLoad: (dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'muscleLoad', dateFrom, dateTo] as const,
        recoveryState: ['analytics', 'recoveryState'] as const,
        progressInsights: (period: string, dateFrom: string | null, dateTo: string | null) =>
            ['analytics', 'progressInsights', period, dateFrom, dateTo] as const,
        workoutSummary: (workoutId: number) => ['analytics', 'workoutSummary', workoutId] as const,
        muscleSignals: ['analytics', 'muscleSignals'] as const,
    },
    challenges: {
        dashboard: ['challenges', 'dashboard'] as const,
    },
} as const
