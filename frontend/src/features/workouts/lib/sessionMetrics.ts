import type { CompletedExercise, WorkoutSessionMetrics } from '@features/workouts/types/workouts'

function round(value: number, digits = 1): number {
    return Number(value.toFixed(digits))
}

export function computeSessionMetricsPreview(
    exercises: CompletedExercise[],
    durationMinutes?: number,
): WorkoutSessionMetrics | null {
    if (!exercises.length) return null

    let completedSets = 0
    let totalVolume = 0
    let restCandidates = 0
    const rpeValues: number[] = []
    const rirValues: number[] = []
    const restValues: number[] = []
    const orderedRpe: number[] = []
    const effort = { easy: 0, moderate: 0, hard: 0, maximal: 0 }

    for (const exercise of exercises) {
        let completedInExercise = 0
        for (const set of exercise.sets_completed) {
            if (!set.completed) continue
            completedSets += 1
            completedInExercise += 1

            if (typeof set.reps === 'number' && typeof set.weight === 'number') {
                totalVolume += set.reps * set.weight
            }
            if (typeof set.rpe === 'number') {
                rpeValues.push(set.rpe)
                orderedRpe.push(set.rpe)
                if (set.rpe <= 6.5) effort.easy += 1
                else if (set.rpe <= 7.5) effort.moderate += 1
                else if (set.rpe < 9) effort.hard += 1
                else effort.maximal += 1
            }
            if (typeof set.rir === 'number') {
                rirValues.push(set.rir)
            }
            const restSeconds =
                typeof set.rest_seconds === 'number'
                    ? set.rest_seconds
                    : typeof set.actual_rest_seconds === 'number'
                        ? set.actual_rest_seconds
                        : null
            if (typeof restSeconds === 'number' && restSeconds >= 0) {
                restValues.push(restSeconds)
            }
        }
        if (completedInExercise > 1) {
            restCandidates += completedInExercise - 1
        }
    }

    if (completedSets === 0) return null

    const avgRpe = rpeValues.length > 0 ? round(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length, 2) : null
    const avgRir = rirValues.length > 0 ? round(rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length, 2) : null
    const avgRest = restValues.length > 0 ? round(restValues.reduce((sum, value) => sum + value, 0) / restValues.length, 1) : null
    const totalRest = restValues.reduce((sum, value) => sum + value, 0)
    const restTrackingRatio = restCandidates > 0 ? round(Math.min(1, restValues.length / restCandidates), 2) : 0

    let restConsistencyScore: number | null = null
    if (restValues.length >= 2 && avgRest && avgRest > 0) {
        const variance = restValues.reduce((sum, value) => sum + (value - avgRest) ** 2, 0) / restValues.length
        const coeffVar = Math.sqrt(variance) / avgRest
        restConsistencyScore = round(Math.max(0, Math.min(100, 100 - coeffVar * 100)), 1)
    }

    let fatigueTrend: WorkoutSessionMetrics['fatigue_trend'] = null
    if (orderedRpe.length >= 2) {
        const midpoint = Math.max(1, Math.floor(orderedRpe.length / 2))
        const opening = orderedRpe.slice(0, midpoint)
        const closing = orderedRpe.slice(midpoint)
        if (closing.length > 0) {
            const openingAvg = opening.reduce((sum, value) => sum + value, 0) / opening.length
            const closingAvg = closing.reduce((sum, value) => sum + value, 0) / closing.length
            fatigueTrend = {
                opening_avg_rpe: round(openingAvg, 2),
                closing_avg_rpe: round(closingAvg, 2),
                delta: round(closingAvg - openingAvg, 2),
            }
        }
    }

    return {
        completed_sets: completedSets,
        avg_rpe: avgRpe,
        avg_rir: avgRir,
        total_rest_seconds: Math.round(totalRest),
        avg_rest_seconds: avgRest,
        rest_tracked_sets: restValues.length,
        rest_tracking_ratio: restTrackingRatio,
        rest_consistency_score: restConsistencyScore,
        fatigue_trend: fatigueTrend,
        effort_distribution: effort,
        volume_per_minute:
            typeof durationMinutes === 'number' && durationMinutes > 0 ? round(totalVolume / durationMinutes, 2) : null,
    }
}


export function buildSessionPreviewLines(metrics: WorkoutSessionMetrics | null): string[] {
    if (!metrics) return []

    const lines: string[] = []
    if (typeof metrics.avg_rpe === 'number') {
        lines.push(`Среднее усилие RPE ${metrics.avg_rpe}`)
    }
    if (typeof metrics.avg_rest_seconds === 'number' && metrics.rest_tracked_sets > 0) {
        lines.push(`Отдых ${Math.round(metrics.avg_rest_seconds)} сек в среднем`)
    }
    if (metrics.fatigue_trend) {
        if (metrics.fatigue_trend.delta >= 1) {
            lines.push('К концу подходы стали тяжелее')
        } else if (metrics.fatigue_trend.delta <= -1) {
            lines.push('К концу нагрузка ощущалась легче')
        }
    }
    return lines.slice(0, 3)
}