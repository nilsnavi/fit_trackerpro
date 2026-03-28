/** Модель упражнения для экрана каталога (фильтры и карточки). */

export type ExerciseCategory =
    | 'all'
    | 'legs'
    | 'back'
    | 'chest'
    | 'shoulders'
    | 'arms'
    | 'cardio'
    | 'stretching'

export type EquipmentType = 'barbell' | 'dumbbells' | 'bodyweight' | 'machines' | 'cables' | 'kettlebell'
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

export interface ExerciseFilters {
    search: string
    categories: ExerciseCategory[]
    equipment: EquipmentType[]
    risks: RiskType[]
    difficulty: DifficultyLevel[]
}
