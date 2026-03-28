/** Ответы GET /exercises (согласно backend ExerciseResponse / ExerciseListResponse). */

export interface ExerciseRiskFlagsApi {
    high_blood_pressure: boolean
    diabetes: boolean
    joint_problems: boolean
    back_problems: boolean
    heart_conditions: boolean
}

export interface ExerciseApiItem {
    id: number
    name: string
    description: string | null
    category: string
    equipment: string[]
    muscle_groups: string[]
    risk_flags: ExerciseRiskFlagsApi
    media_url: string | null
    status: string
    author_user_id: number | null
    created_at: string
    updated_at: string
}

export interface ExerciseListApiResponse {
    items: ExerciseApiItem[]
    total: number
    page: number
    page_size: number
    filters: Record<string, unknown>
}
