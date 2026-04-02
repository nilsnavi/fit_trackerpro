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

/** Ответ API `POST/PUT /workouts/templates` */
export interface WorkoutTemplateResponse {
    id: number
    user_id: number
    name: string
    type: BackendWorkoutType
    exercises: ExerciseInTemplate[]
    is_public: boolean
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
    duration?: number
    completed: boolean
}

export interface CompletedExercise {
    exercise_id: number
    name: string
    sets_completed: CompletedSet[]
    notes?: string
}

export interface WorkoutStartRequest {
    template_id?: number
    name?: string
    type?: WorkoutStartType
}

export interface WorkoutStartResponse {
    id: number
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
    completed_at: string
    message: string
}

export interface WorkoutHistoryItem {
    id: number
    date: string
    duration?: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
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
