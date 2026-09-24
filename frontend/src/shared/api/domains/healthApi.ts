import { api } from '@shared/api/client'
import type {
    BodyMeasurement,
    BodyMeasurementHistory,
    BodyMeasurementType,
    GlucoseReading,
    GlucoseStats,
    HealthDashboardStats,
    WaterDailyStats,
    WaterEntry,
    WaterGoal,
    WaterReminder,
    WaterWeeklyStats,
    WellnessEntry,
    WellnessStats,
} from '@features/health/types/metrics'

const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0]
}

export const healthApi = {
    getBodyMeasurements(params?: {
        page?: number
        page_size?: number
        date_from?: string
        date_to?: string
        measurement_type?: BodyMeasurementType
        latest?: boolean
    }): Promise<BodyMeasurementHistory> {
        return api.get<BodyMeasurementHistory>('/health/body-measurements', params)
    },

    addBodyMeasurement(payload: {
        measurement_type: BodyMeasurementType
        value_cm: number
        measured_at: string
    }): Promise<BodyMeasurement> {
        return api.post<BodyMeasurement>('/health/body-measurements', payload)
    },

    updateBodyMeasurement(
        measurementId: number,
        payload: Partial<Pick<BodyMeasurement, 'measurement_type' | 'value_cm' | 'measured_at'>>,
    ): Promise<BodyMeasurement> {
        return api.patch<BodyMeasurement>(`/health/body-measurements/${measurementId}`, payload)
    },

    deleteBodyMeasurement(measurementId: number): Promise<void> {
        return api.delete(`/health/body-measurements/${measurementId}`)
    },

    getWaterGoal(): Promise<WaterGoal> {
        return api.get<WaterGoal>('/health-metrics/water/goal')
    },

    getWaterReminder(): Promise<WaterReminder> {
        return api.get<WaterReminder>('/health-metrics/water/reminder')
    },

    getWaterToday(): Promise<WaterDailyStats> {
        const today = getTodayDate()
        return api.get<WaterDailyStats>(`/health-metrics/water/daily/${today}`)
    },

    getWaterDailyStats(date: string): Promise<WaterDailyStats> {
        return api.get<WaterDailyStats>(`/health-metrics/water/daily/${date}`)
    },

    getWaterWeeklyStats(_period?: string): Promise<WaterWeeklyStats> {
        return api.get<WaterWeeklyStats>('/health-metrics/water/weekly')
    },

    getWaterHistory(params?: {
        page?: number
        page_size?: number
        date_from?: string
        date_to?: string
    }): Promise<{
        items: WaterEntry[]
        total: number
        page: number
        page_size: number
        total_amount: number
    }> {
        return api.get('/health-metrics/water', params)
    },

    addWaterEntry(payload: { amount: number; recorded_at?: string }): Promise<WaterEntry> {
        return api.post<WaterEntry>('/health-metrics/water', payload)
    },

    updateWaterGoal(payload: Partial<WaterGoal>): Promise<WaterGoal> {
        return api.post<WaterGoal>('/health-metrics/water/goal', payload)
    },

    updateWaterReminder(payload: Partial<WaterReminder>): Promise<WaterReminder> {
        return api.post<WaterReminder>('/health-metrics/water/reminder', payload)
    },

    deleteWaterEntry(entryId: number): Promise<void> {
        return api.delete(`/health-metrics/water/${entryId}`)
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
