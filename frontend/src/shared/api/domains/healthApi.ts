import { api } from '@shared/api/client'
import type {
    GlucoseReading,
    GlucoseStats,
    HealthDashboardStats,
    WaterEntry,
    WaterGoal,
    WaterReminder,
    WaterWeeklyStats,
    WellnessEntry,
    WellnessStats,
} from '@features/health/types/metrics'

export const healthApi = {
    getWaterGoal(): Promise<WaterGoal> {
        return api.get<WaterGoal>('/health-metrics/water/goal')
    },
    getWaterReminder(): Promise<WaterReminder> {
        return api.get<WaterReminder>('/health-metrics/water/reminder')
    },
    getWaterToday(): Promise<WaterEntry[]> {
        return api.get<WaterEntry[]>('/health-metrics/water/today')
    },
    getWaterWeeklyStats(period: string): Promise<WaterWeeklyStats> {
        return api.get<WaterWeeklyStats>('/health-metrics/water/stats', { period })
    },
    addWaterEntry(payload: { amount: number; recorded_at: string }): Promise<WaterEntry> {
        return api.post<WaterEntry>('/health-metrics/water', payload)
    },
    updateWaterGoal(payload: Partial<WaterGoal>): Promise<WaterGoal> {
        return api.put<WaterGoal>('/health-metrics/water/goal', payload)
    },
    updateWaterReminder(payload: Partial<WaterReminder>): Promise<WaterReminder> {
        return api.put<WaterReminder>('/health-metrics/water/reminder', payload)
    },

    getGlucoseStats(period: string): Promise<GlucoseStats> {
        return api.get<GlucoseStats>('/health-metrics/glucose/stats', { period })
    },
    getGlucoseReadings(params: { limit?: number }): Promise<GlucoseReading[]> {
        return api.get<GlucoseReading[]>('/health-metrics/glucose', params)
    },
    addGlucoseReading(
        payload: Omit<GlucoseReading, 'id' | 'user_id' | 'created_at'>,
    ): Promise<GlucoseReading> {
        return api.post<GlucoseReading>('/health-metrics/glucose', payload)
    },

    getWellness(params: { date?: string; limit?: number }): Promise<WellnessEntry[]> {
        return api.get<WellnessEntry[]>('/health-metrics/wellness', params)
    },
    getWellnessStats(): Promise<WellnessStats> {
        return api.get<WellnessStats>('/health-metrics/wellness/stats')
    },
    getDashboardStats(period: string): Promise<HealthDashboardStats> {
        return api.get<HealthDashboardStats>('/health-metrics/stats', { period })
    },
    createWellnessEntry(payload: unknown): Promise<WellnessEntry> {
        return api.post<WellnessEntry>('/health-metrics/wellness', payload)
    },
}
