import type { WorkoutType } from '@shared/types'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { estimateCaloriesForType } from '@features/workouts/config/workoutTypeConfigs'

export interface WorkoutListItem {
    id: number
    title: string
    type: WorkoutType
    duration: number
    calories: number
    date: string
}

export const detectWorkoutType = (item: WorkoutHistoryItem): WorkoutType => {
    const tags = item.tags.map((tag) => tag.toLowerCase())

    if (tags.includes('sports') || tags.includes('sport')) return 'sports'
    if (tags.includes('cardio')) return 'cardio'
    if (tags.includes('strength')) return 'strength'
    if (tags.includes('flexibility') || tags.includes('yoga')) return 'flexibility'

    const hasReps = item.exercises.some((exercise) =>
        exercise.sets_completed.some((set) => typeof set.reps === 'number' && set.reps > 0),
    )
    const hasDurationOnly = item.exercises.some((exercise) =>
        exercise.sets_completed.some((set) => typeof set.duration === 'number' && !set.reps),
    )

    if (hasDurationOnly && !hasReps) return 'cardio'
    if (hasReps) return 'strength'

    return 'other'
}

export const toWorkoutListItem = (item: WorkoutHistoryItem): WorkoutListItem => {
    const duration = item.duration ?? 0
    const type = detectWorkoutType(item)
    const firstExerciseName = item.exercises[0]?.name
    const title = item.comments?.trim() || firstExerciseName || `Тренировка #${item.id}`

    return {
        id: item.id,
        title,
        type,
        duration,
        calories: estimateCaloriesForType(type, duration),
        date: item.date,
    }
}
