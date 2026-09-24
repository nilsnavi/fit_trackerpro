import type { CompletedExercise, CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'

/**
 * SPEC-005 §8: previous completed result for one exercise.
 * Warm-up sets are excluded from the working previous result (§8/§10).
 */
export interface PreviousExerciseResult {
    date: string
    /** Ordered working sets of the latest completed session. */
    sets: CompletedSet[]
    rpeValues: number[]
    volume: number
    sessionId: number
}

/** Warm-up sets are excluded from the working previous result (§8/§10). */
function isWorkingSet(set: CompletedSet): boolean {
    return (set.set_type ?? 'working') !== 'warmup' && set.completed
}

function setVolumeKg(set: CompletedSet): number {
    return (set.weight ?? 0) * (set.reps ?? 0)
}

/**
 * Latest completed workout containing the exercise, with warm-up sets filtered
 * out of the working result. Returns null when there is no history
 * ("Первое выполнение упражнения", §8).
 */
export function findPreviousResult(
    historyItems: WorkoutHistoryItem[] | undefined,
    currentWorkoutId: number | undefined,
    exercise: Pick<CompletedExercise, 'exercise_id' | 'name'>,
): PreviousExerciseResult | null {
    const normalizedName = exercise.name.trim().toLowerCase()
    for (const item of historyItems ?? []) {
        if (item.id === currentWorkoutId) continue
        // Only completed workouts count as history (§8: последняя завершённая тренировка).
        if (item.duration == null || item.duration <= 0) continue
        const match = item.exercises.find((candidate) => {
            if (candidate.exercise_id === exercise.exercise_id) return true
            return candidate.name.trim().toLowerCase() === normalizedName
        })
        if (!match) continue

        const workingSets = match.sets_completed.filter(isWorkingSet)
        if (workingSets.length === 0) continue

        return {
            date: item.date,
            sets: workingSets,
            rpeValues: workingSets
                .map((set) => set.rpe)
                .filter((value): value is number => typeof value === 'number'),
            volume: Math.round(workingSets.reduce((sum, set) => sum + setVolumeKg(set), 0)),
            sessionId: item.id,
        }
    }
    return null
}

/** Format previous result lines like "80 × 10" (§8 mock). */
export function formatPreviousSetLine(set: CompletedSet): string {
    if (typeof set.duration === 'number') {
        return `${set.duration} сек`
    }
    const weight = typeof set.weight === 'number' ? set.weight : null
    const reps = typeof set.reps === 'number' ? set.reps : null
    if (weight != null && reps != null) return `${weight} × ${reps}`
    if (weight != null) return `${weight} кг`
    if (reps != null) return `${reps}`
    return '—'
}
