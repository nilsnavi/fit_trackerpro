export interface User {
    id: number
    telegram_id: number
    username?: string
    first_name?: string
    last_name?: string
    created_at: string
    updated_at: string
}

export type WorkoutType = 'cardio' | 'strength' | 'flexibility' | 'sports' | 'other'

export interface Workout {
    id: number
    user_id: number
    type: WorkoutType
    title: string
    description?: string
    duration_minutes: number
    calories_burned?: number
    started_at: string
    ended_at?: string
    created_at: string
}

export type MetricType = 'weight' | 'steps' | 'heart_rate' | 'sleep' | 'water' | 'calories'

export interface HealthMetric {
    id: number
    user_id: number
    metric_type: MetricType
    value: number
    unit: string
    recorded_at: string
    notes?: string
    created_at: string
}

export interface HealthStats {
    metric_type: MetricType
    current_value: number
    average_value: number
    min_value: number
    max_value: number
    change_7d?: number
    change_30d?: number
}

export interface ApiResponse<T> {
    data: T
    message?: string
}

export type ExerciseCategory = 'all' | 'strength' | 'cardio' | 'flexibility' | 'balance' | 'sport'
export type EquipmentType =
    | 'none'
    | 'dumbbells'
    | 'barbell'
    | 'kettlebell'
    | 'resistance_bands'
    | 'pull_up_bar'
    | 'bench'
    | 'cable_machine'
    | 'smith_machine'
    | 'leg_press'
    | 'treadmill'
    | 'exercise_bike'
    | 'rowing_machine'
    | 'elliptical'
    | 'medicine_ball'
    | 'foam_roller'
    | 'yoga_mat'
    | 'machine'
export type RiskType = 'shoulder' | 'knee' | 'back' | 'wrist' | 'elbow'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Exercise {
    id: number
    name: string
    category: Exclude<ExerciseCategory, 'all'>
    equipment: EquipmentType[]
    primaryMuscles: string[]
    secondaryMuscles: string[]
    difficulty: DifficultyLevel
    risks: RiskType[]
    description: string
    instructions: string[]
    tips: string[]
    videoUrl?: string
    gifUrl?: string
    imageUrl?: string
    isCustom: boolean
    createdBy?: number
    similarExercises?: number[]
}
