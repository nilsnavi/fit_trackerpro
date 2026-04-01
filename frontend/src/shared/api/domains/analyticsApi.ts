import { api } from '@shared/api/client'

export const analyticsApi = {
    getSummary(params?: Record<string, unknown>) {
        return api.get('/analytics/summary', params)
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
}
