import type { WorkoutMode } from './workoutTypeConfigs'
import { WORKOUT_MODE_ORDER } from './workoutTypeConfigs'

type FitnessGoal = 'strength' | 'weight_loss' | 'endurance'

const GOAL_TO_MODE: Record<FitnessGoal, WorkoutMode> = {
    strength: 'strength',
    weight_loss: 'functional',
    endurance: 'cardio',
}

export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
    strength: 'Сила',
    weight_loss: 'Похудение',
    endurance: 'Выносливость',
}

export function getRecommendedMode(fitnessGoal?: string): WorkoutMode | null {
    if (!fitnessGoal) return null
    return GOAL_TO_MODE[fitnessGoal as FitnessGoal] ?? null
}

export function getOrderedModes(fitnessGoal?: string): {
    order: readonly WorkoutMode[]
    recommended: WorkoutMode | null
} {
    const recommended = getRecommendedMode(fitnessGoal)
    if (!recommended) return { order: WORKOUT_MODE_ORDER, recommended: null }

    const order = [
        recommended,
        ...WORKOUT_MODE_ORDER.filter((m) => m !== recommended),
    ] as const
    return { order, recommended }
}
