import { api } from '@/services/api'

export const analyticsApi = {
    getSummary(params?: Record<string, unknown>) {
        return api.get('/analytics/summary', params)
    },
    getProgress(params?: Record<string, unknown>) {
        return api.get('/analytics/progress', params)
    },
    getCalendar(params?: Record<string, unknown>) {
        return api.get('/analytics/calendar', params)
    },
    getMuscleLoad(params?: Record<string, unknown>) {
        return api.get('/analytics/muscle-load', params)
    },
}
