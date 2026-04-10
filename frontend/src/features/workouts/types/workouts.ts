import type { WorkoutType } from '@shared/types'

export type BackendWorkoutType = 'cardio' | 'strength' | 'flexibility' | 'mixed'
export type WorkoutStartType = BackendWorkoutType | 'custom'

export interface ExerciseInTemplate {
    exercise_id: number
    name: string
    sets: number
    reps?: number
    duration?: number
    rest_seconds: number
    weight?: number
    notes?: string
}

export interface WorkoutTemplateCreateRequest {
    name: string
    type: BackendWorkoutType
    exercises: ExerciseInTemplate[]
    is_public: boolean
}

export interface WorkoutTemplateCreateFromWorkoutRequest {
    workout_id: number
    name?: string
    is_public?: boolean
}

export interface WorkoutTemplateCloneRequest {
    name?: string
    is_public?: boolean
}

export interface WorkoutTemplatePatchRequest {
    expected_version: number
    name?: string
    type?: BackendWorkoutType
    exercises?: ExerciseInTemplate[]
    is_public?: boolean
    exercise_order?: number[]
}

/** Ответ API `POST/PUT /workouts/templates` */
export interface WorkoutTemplateResponse {
    id: number
    user_id: number
    name: string
    type: BackendWorkoutType
    exercises: ExerciseInTemplate[]
    is_public: boolean
    is_archived: boolean
    version: number
    created_at: string
    updated_at: string
}

export interface WorkoutTemplateListResponse {
    items: WorkoutTemplateResponse[]
    total: number
    page: number
    page_size: number
}

export interface CompletedSet {
    set_number: number
    reps?: number
    weight?: number
    rpe?: number
    rir?: number
    planned_rest_seconds?: number
    actual_rest_seconds?: number
    duration?: number
    distance?: number
    completed: boolean
}

export interface CompletedExercise {
    exercise_id: number
    name: string
    sets_completed: CompletedSet[]
    notes?: string
}

export interface SessionFatigueTrend {
    opening_avg_rpe: number
    closing_avg_rpe: number
    delta: number
}

export interface SessionEffortDistribution {
    easy: number
    moderate: number
    hard: number
    maximal: number
}

export interface WorkoutSessionMetrics {
    completed_sets: number
    avg_rpe?: number | null
    avg_rir?: number | null
    total_rest_seconds: number
    avg_rest_seconds?: number | null
    rest_tracked_sets: number
    rest_tracking_ratio: number
    rest_consistency_score?: number | null
    fatigue_trend?: SessionFatigueTrend | null
    effort_distribution: SessionEffortDistribution
    volume_per_minute?: number | null
}

export interface WorkoutStartRequest {
    template_id?: number
    name?: string
    type?: WorkoutStartType
}

export interface WorkoutStartTemplateOverrides {
    exercises?: ExerciseInTemplate[]
    comments?: string
    tags?: string[]
}

export interface WorkoutStartFromTemplateRequest {
    name?: string
    type?: WorkoutStartType
    overrides?: WorkoutStartTemplateOverrides
}

export interface WorkoutStartResponse {
    id: number
    /** Legacy compatibility: some deployments may still return workout_id instead of id. */
    workout_id?: number
    user_id: number
    template_id?: number
    date: string
    start_time: string
    status: string
    message: string
}

export interface WorkoutCompleteRequest {
    duration: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
}

export interface WorkoutSessionUpdateRequest {
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
}

export interface WorkoutCompleteResponse {
    id: number
    user_id: number
    template_id?: number
    date: string
    duration: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
    session_metrics?: WorkoutSessionMetrics | null
    version?: number
    completed_at: string
    message: string
}

export interface WorkoutHistoryItem {
    id: number
    /** Legacy compatibility: some deployments may still return workout_id instead of id. */
    workout_id?: number
    template_id?: number
    date: string
    duration?: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
    session_metrics?: WorkoutSessionMetrics | null
    version?: number
    created_at: string
}

export interface WorkoutHistoryResponse {
    items: WorkoutHistoryItem[]
    total: number
    page: number
    page_size: number
    date_from?: string
    date_to?: string
}

export interface CalendarWorkout {
    id: number
    title: string
    type: WorkoutType
    status: 'completed' | 'partial' | 'missed' | 'planned'
    duration_minutes: number
    calories_burned?: number
    scheduled_at: string
    completed_at?: string
}
