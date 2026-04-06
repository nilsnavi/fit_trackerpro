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
