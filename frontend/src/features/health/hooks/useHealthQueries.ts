import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { healthMetricsApi } from '@features/health/api/healthMetricsApi'
import type {
    GlucoseReading,
    WaterGoal,
    WaterReminder,
} from '@features/health/types/metrics'

const WATER_STATS_PERIOD = '7d'
const GLUCOSE_STATS_PERIOD = '7d'
const WELLNESS_RECENT_LIMIT = 30

export function useWaterGoalQuery() {
    return useQuery({
        queryKey: queryKeys.health.waterGoal,
        queryFn: () => healthMetricsApi.getWaterGoal(),
    })
}

export function useWaterReminderQuery() {
    return useQuery({
        queryKey: queryKeys.health.waterReminder,
        queryFn: () => healthMetricsApi.getWaterReminder(),
    })
}

export function useWaterTodayQuery() {
    return useQuery({
        queryKey: queryKeys.health.waterToday,
        queryFn: () => healthMetricsApi.getWaterToday(),
    })
}

export function useWaterWeeklyStatsQuery(period: string = WATER_STATS_PERIOD) {
    return useQuery({
        queryKey: queryKeys.health.waterStats(period),
        queryFn: () => healthMetricsApi.getWaterWeeklyStats(period),
    })
}

export function useAddWaterEntryMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: healthMetricsApi.addWaterEntry,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.health.waterToday })
            await qc.invalidateQueries({ queryKey: queryKeys.health.waterStats(WATER_STATS_PERIOD) })
        },
    })
}

export function useUpdateWaterGoalMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: Partial<WaterGoal>) => healthMetricsApi.updateWaterGoal(payload),
        onSuccess: async (data) => {
            qc.setQueryData(queryKeys.health.waterGoal, data)
            await qc.invalidateQueries({ queryKey: queryKeys.health.waterStats(WATER_STATS_PERIOD) })
        },
    })
}

export function useUpdateWaterReminderMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: Partial<WaterReminder>) =>
            healthMetricsApi.updateWaterReminder(payload),
        onSuccess: (data) => {
            qc.setQueryData(queryKeys.health.waterReminder, data)
        },
    })
}

export function useGlucoseStatsQuery(period: string = GLUCOSE_STATS_PERIOD) {
    return useQuery({
        queryKey: queryKeys.health.glucoseStats(period),
        queryFn: () => healthMetricsApi.getGlucoseStats(period),
    })
}

export function useGlucoseReadingsQuery(limit: number) {
    return useQuery({
        queryKey: queryKeys.health.glucoseReadings(limit),
        queryFn: () => healthMetricsApi.getGlucoseReadings({ limit }),
    })
}

export function useAddGlucoseReadingMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: Omit<GlucoseReading, 'id' | 'user_id' | 'created_at'>) =>
            healthMetricsApi.addGlucoseReading(payload),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['health', 'glucose'] })
        },
    })
}

export function useWellnessByDateQuery(date: string) {
    return useQuery({
        queryKey: queryKeys.health.wellnessByDate(date),
        queryFn: () => healthMetricsApi.getWellness({ date }),
    })
}

export function useWellnessRecentQuery(limit: number = WELLNESS_RECENT_LIMIT) {
    return useQuery({
        queryKey: queryKeys.health.wellnessRecent(limit),
        queryFn: () => healthMetricsApi.getWellness({ limit }),
    })
}

export function useWellnessStatsQuery() {
    return useQuery({
        queryKey: queryKeys.health.wellnessStats,
        queryFn: () => healthMetricsApi.getWellnessStats(),
    })
}

export function useCreateWellnessEntryMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: healthMetricsApi.createWellnessEntry,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['health', 'wellness'] })
        },
    })
}
