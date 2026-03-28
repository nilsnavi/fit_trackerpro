import { api } from '@shared/api/client'

export const healthApi = {
    getGlucoseHistory(params?: Record<string, unknown>) {
        return api.get('/health-metrics/glucose', params)
    },
    createGlucose(payload: unknown) {
        return api.post('/health-metrics/glucose', payload)
    },
    getWellnessHistory(params?: Record<string, unknown>) {
        return api.get('/health-metrics/wellness', params)
    },
    createWellness(payload: unknown) {
        return api.post('/health-metrics/wellness', payload)
    },
    getStats(params?: Record<string, unknown>) {
        return api.get('/health-metrics/stats', params)
    },
}
