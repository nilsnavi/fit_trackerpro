import { api } from '@shared/api/client'

export const analyticsApi = {
    getDashboard(params?: { period?: string }) {
        return api.get('/analytics', params)
    },
    /** GET /api/v1/analytics/workouts — сводка тренировок по периоду (см. AnalyticsDashboardResponse). */
    getWorkoutStats(params?: { period?: string }) {
        return api.get('/analytics/workouts', params)
    },
    getSummary(params?: Record<string, unknown>) {
        return api.get('/analytics/summary', params)
    },
    getPerformanceOverview(params?: Record<string, unknown>) {
        return api.get('/analytics/performance-overview', params)
    },
    getProgress(params?: Record<string, unknown>) {
        return api.get('/analytics/progress', params)
    },
    getTrainingLoadDaily(params?: Record<string, unknown>) {
        return api.get('/analytics/training-load/daily', params)
    },
    getCalendar(params?: Record<string, unknown>) {
        return api.get('/analytics/calendar', params)
    },
    getMuscleLoad(params?: Record<string, unknown>) {
        return api.get('/analytics/muscle-load', params)
    },
    getRecoveryState() {
        return api.get('/analytics/recovery-state')
    },
    getProgressInsights(params?: Record<string, unknown>) {
        return api.get('/analytics/progress-insights', params)
    },
    getWorkoutSummary(params?: Record<string, unknown>) {
        return api.get('/analytics/workout-summary', params)
    },
    getMuscleSignals() {
        return api.get('/analytics/muscle-signals')
    },
    recalculateRecoveryState(params?: { target_date?: string; date_from?: string; date_to?: string }) {
        // Backend expects query params, not body (FastAPI Query parameters)
        const query = new URLSearchParams()
        if (params?.target_date) query.set('target_date', params.target_date)
        if (params?.date_from) query.set('date_from', params.date_from)
        if (params?.date_to) query.set('date_to', params.date_to)
        const queryString = query.toString()
        return api.post(`/analytics/recovery-state/recalculate${queryString ? `?${queryString}` : ''}`)
    },
}
