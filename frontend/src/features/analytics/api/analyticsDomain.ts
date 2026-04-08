import { analyticsApi } from '@shared/api/domains/analyticsApi'

export type ApiDate = string

export interface ApiExerciseProgressPoint {
    date: ApiDate
    max_weight: number | null
    reps: number | null
}

export interface ApiExerciseProgressSummary {
    exercise_id: number
    exercise_name: string
    progress_percentage: number | null
}

export interface ApiExerciseProgressResponse {
    exercise_id: number
    exercise_name: string
    period: string
    data_points: ApiExerciseProgressPoint[]
    summary: ApiExerciseProgressSummary
    best_performance?: {
        date: ApiDate
        weight: number | null
        reps: number | null
    } | null
}

export interface ApiAnalyticsSummaryResponse {
    total_workouts: number
    total_duration: number
    total_exercises: number
    current_streak: number
    longest_streak: number
    personal_records: unknown[]
    favorite_exercises: unknown[]
    weekly_average: number
    monthly_average: number
}

export interface ApiTrainingLoadDailyEntry {
    date: ApiDate
    volume: number
    fatigueScore: number
    avgRpe: number | null
}

export interface ApiMuscleLoadEntry {
    date: ApiDate
    muscleGroup: string
    loadScore: number
}

export interface ApiRecoveryStateResponse {
    fatigueLevel: number
    readinessScore: number
}

export interface ApiProgressInsightsVolumePoint {
    date: ApiDate
    workout_count: number
    total_sets: number
    total_reps: number
    total_volume: number
}

export interface ApiProgressInsightsFrequencyPoint {
    week_start: ApiDate
    week_end: ApiDate
    active_days: number
    workout_count: number
}

export interface ApiProgressInsightsPRItem {
    exercise_id: number
    exercise_name: string
    date: ApiDate
    weight: number | null
    reps: number | null
    previous_best_weight: number | null
    improvement: number | null
    improvement_pct: number | null
    is_first_entry: boolean
}

export interface ApiProgressInsightsBestSetItem {
    exercise_id: number
    exercise_name: string
    date: ApiDate
    set_number: number | null
    weight: number | null
    reps: number | null
    volume: number
}

export interface ApiProgressInsightsResponse {
    period: string
    date_from: ApiDate
    date_to: ApiDate
    summary: {
        total_workouts: number
        active_days: number
        total_sets: number
        total_reps: number
        total_volume: number
        average_workouts_per_week: number
    }
    volume_trend: ApiProgressInsightsVolumePoint[]
    frequency_trend: ApiProgressInsightsFrequencyPoint[]
    best_sets: ApiProgressInsightsBestSetItem[]
    pr_events: ApiProgressInsightsPRItem[]
}

export interface ApiWorkoutPostSummaryResponse {
    workout_id: number
    date: ApiDate
    duration: number
    total_sets: number
    total_reps: number
    total_volume: number
    best_sets: ApiProgressInsightsBestSetItem[]
    pr_events: ApiProgressInsightsPRItem[]
}

export function getAnalyticsSummary(params?: Record<string, unknown>) {
    return analyticsApi.getSummary(params) as Promise<ApiAnalyticsSummaryResponse>
}

export function getAnalyticsProgress(params?: Record<string, unknown>) {
    return analyticsApi.getProgress(params) as Promise<ApiExerciseProgressResponse[]>
}

export function getAnalyticsTrainingLoadDaily(params?: Record<string, unknown>) {
    return analyticsApi.getTrainingLoadDaily(params) as Promise<ApiTrainingLoadDailyEntry[]>
}

export function getAnalyticsMuscleLoad(params?: Record<string, unknown>) {
    return analyticsApi.getMuscleLoad(params) as Promise<ApiMuscleLoadEntry[]>
}

export function getAnalyticsRecoveryState() {
    return analyticsApi.getRecoveryState() as Promise<ApiRecoveryStateResponse>
}

export function getAnalyticsProgressInsights(params?: Record<string, unknown>) {
    return analyticsApi.getProgressInsights(params) as Promise<ApiProgressInsightsResponse>
}

export function getAnalyticsWorkoutSummary(params: { workout_id: number }) {
    return analyticsApi.getWorkoutSummary(params) as Promise<ApiWorkoutPostSummaryResponse>
}
