import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { countExercisesDone } from './exerciseSessionDerivation'

export type WorkoutSessionSummaryMetrics = {
    totalDurationSeconds: number
    totalSetsCompleted: number
    exercisesCompleted: number
    totalVolumeKg: number
}

export function computeWorkoutSessionSummaryMetrics(
    workout: WorkoutHistoryItem | undefined,
    elapsedSeconds: number,
    currentExerciseIndex: number,
    currentSetIndex: number,
): WorkoutSessionSummaryMetrics {
    if (!workout) {
        return {
            totalDurationSeconds: Math.max(0, elapsedSeconds),
            totalSetsCompleted: 0,
            exercisesCompleted: 0,
            totalVolumeKg: 0,
        }
    }

    let totalSetsCompleted = 0
    let totalVolumeKg = 0

    for (const ex of workout.exercises) {
        for (const set of ex.sets_completed) {
            if (set.completed) {
                totalSetsCompleted += 1
                const w = typeof set.weight === 'number' ? set.weight : 0
                const r = typeof set.reps === 'number' ? set.reps : 0
                totalVolumeKg += w * r
            }
        }
    }

    const exercisesCompleted = countExercisesDone(workout.exercises, currentExerciseIndex, currentSetIndex)

    return {
        totalDurationSeconds: Math.max(0, elapsedSeconds),
        totalSetsCompleted,
        exercisesCompleted,
        totalVolumeKg,
    }
}

export function formatMmSs(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function formatDurationRu(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) {
        return `${h}ч ${m}мин`
    }
    return formatMmSs(s)
}
