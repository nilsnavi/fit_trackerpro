import type { CompletedExercise, CompletedSet, ProgressionTargetInfo } from '@features/workouts/types/workouts'

/** SPEC-006 §58: what the accepted target replaced, ready for the UI. */
export interface ProgressionPrefillSummary {
    target: ProgressionTargetInfo
    /** Human label of the seeded value, e.g. `82.5 кг` or `65 сек`. */
    label: string
    /** Planned value the one-tap revert restores, or null when the plan was empty. */
    plannedValue: number | null
    /** Label of the planned value, e.g. `80 кг`; null when there was no plan. */
    plannedLabel: string | null
}

function isWarmup(set: CompletedSet): boolean {
    return (set.set_type ?? 'working') === 'warmup'
}

function formatValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatProgressionValue(value: number, unit: ProgressionTargetInfo['unit']): string {
    return unit === 'seconds' ? `${Math.round(value)} сек` : `${formatValue(value)} кг`
}

/**
 * SPEC-006 §58: working sets still carrying the seeded value of an accepted
 * progression target. Warm-up sets are never seeded, so they are ignored.
 */
export function seededWorkingSets(exercise: CompletedExercise): CompletedSet[] {
    if (!exercise.progression_target) return []
    return exercise.sets_completed.filter(
        (set) =>
            !isWarmup(set) && (set.planned_weight !== undefined || set.planned_duration !== undefined),
    )
}

/**
 * Summary of the prefill marker for the active exercise, or null when its
 * numbers are the user's own (nothing to explain or revert).
 */
export function describeProgressionPrefill(exercise: CompletedExercise): ProgressionPrefillSummary | null {
    const target = exercise.progression_target
    if (!target) return null
    const seeded = seededWorkingSets(exercise)
    if (seeded.length === 0) return null

    const planned = target.unit === 'seconds'
        ? seeded[0].planned_duration ?? null
        : seeded[0].planned_weight ?? null

    return {
        target,
        label: formatProgressionValue(target.value, target.unit),
        plannedValue: planned,
        plannedLabel: planned == null ? null : formatProgressionValue(planned, target.unit),
    }
}

/**
 * SPEC-006 §58: one-tap revert — every seeded working set goes back to the
 * planned value (an empty plan clears the field) and the marker disappears, so
 * the session stops claiming a target it no longer uses.
 */
export function revertProgressionPrefill(exercise: CompletedExercise): CompletedExercise {
    if (!exercise.progression_target) return exercise
    const sets_completed = exercise.sets_completed.map((set) => {
        if (isWarmup(set) || (set.planned_weight === undefined && set.planned_duration === undefined)) {
            return set
        }
        const reverted: CompletedSet = { ...set }
        delete reverted.planned_weight
        delete reverted.planned_duration
        if (set.planned_weight !== undefined) {
            if (set.planned_weight === null) delete reverted.weight
            else reverted.weight = set.planned_weight
        }
        if (set.planned_duration !== undefined) {
            if (set.planned_duration === null) delete reverted.duration
            else reverted.duration = set.planned_duration
        }
        return reverted
    })
    const revertedExercise: CompletedExercise = { ...exercise, sets_completed }
    delete revertedExercise.progression_target
    return revertedExercise
}
