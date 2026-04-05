import type { WorkoutTemplateResponse } from '@features/workouts/types/workouts'

export function estimateTemplateDurationMinutes(template: WorkoutTemplateResponse): number {
    const totalSeconds = template.exercises.reduce((sum, exercise) => {
        const sets = Math.max(1, exercise.sets || 1)
        const activeSeconds = exercise.duration != null ? Math.max(0, exercise.duration) * 60 : sets * 45
        const restSeconds = Math.max(0, exercise.rest_seconds || 0) * Math.max(0, sets - 1)
        return sum + activeSeconds + restSeconds
    }, 0)

    return Math.max(1, Math.round(totalSeconds / 60))
}
