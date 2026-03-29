/**
 * Модель конструктора шаблона тренировки (локальный выбор упражнений, блоки).
 * Отдельно от каталога `Exercise` в @shared/types (там id: number).
 */
export interface WorkoutBuilderExercise {
    id: string
    name: string
    category: string
    muscleGroups?: string[]
}

export interface WorkoutBlockConfig {
    sets?: number
    reps?: number
    weight?: number
    duration?: number
    restSeconds?: number
    note?: string
    distance?: number
    speed?: number
}

export interface WorkoutBlock {
    id: string
    type: 'strength' | 'cardio' | 'timer' | 'note'
    exercise?: WorkoutBuilderExercise
    config?: WorkoutBlockConfig
    order: number
}
