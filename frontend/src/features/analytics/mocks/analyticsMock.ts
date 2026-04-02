import { format, parseISO } from 'date-fns'
import type {
    ApiAnalyticsSummaryResponse,
    ApiDate,
    ApiExerciseProgressResponse,
    ApiExerciseProgressSummary,
} from '../mappers/analyticsMappers'

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n))
}

function hashString(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

function seeded01(seed: number): number {
    // xorshift32
    let x = seed || 1
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 10_000) / 10_000
}

function dateRangeIso(dateFrom: string, dateTo: string): ApiDate[] {
    const start = parseISO(dateFrom)
    const end = parseISO(dateTo)
    const days: ApiDate[] = []
    // naive day stepping: ok for mocks
    for (
        let d = new Date(start.getTime());
        d.getTime() <= end.getTime();
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    ) {
        days.push(format(d, 'yyyy-MM-dd'))
    }
    return days
}

export function buildMockAnalytics(params: {
    date_from: string
    date_to: string
    period: string
}): {
    summary: ApiAnalyticsSummaryResponse
    progress: ApiExerciseProgressResponse[]
    trainingLoadDaily: Array<{ date: ApiDate; volume: number; fatigueScore: number; avgRpe: number | null }>
    muscleLoad: Array<{ date: ApiDate; muscleGroup: string; loadScore: number }>
    recoveryState: { fatigueLevel: number; readinessScore: number }
} {
    const dates = dateRangeIso(params.date_from, params.date_to)
    const exercises = [
        { id: 1, name: 'Жим лёжа', base: 60 },
        { id: 2, name: 'Присед', base: 80 },
        { id: 3, name: 'Становая тяга', base: 100 },
        { id: 4, name: 'Жим стоя', base: 35 },
        { id: 5, name: 'Тяга в наклоне', base: 50 },
    ]

    const progress: ApiExerciseProgressResponse[] = exercises.map((ex) => {
        const points = dates
            .filter((_d, idx) => idx % 3 === 0) // not every day
            .map((date, idx) => {
                const seed = hashString(`${ex.id}:${date}`)
                const noise = (seeded01(seed) - 0.5) * 4
                const trend = idx * 0.3
                const w = clamp(ex.base + trend + noise, 1, 250)
                return { date, max_weight: Math.round(w * 10) / 10, reps: null }
            })

        const first = points[0]?.max_weight
        const last = points[points.length - 1]?.max_weight
        const progress_percentage =
            typeof first === 'number' && typeof last === 'number' && first > 0
                ? Math.round(((last - first) / first) * 100)
                : 0

        const summary: ApiExerciseProgressSummary = {
            exercise_id: ex.id,
            exercise_name: ex.name,
            progress_percentage,
        }

        const bestPoint = points.reduce<typeof points[number] | null>((best, point) => {
            if (best == null) return point
            return (point.max_weight ?? 0) > (best.max_weight ?? 0) ? point : best
        }, null)

        return {
            exercise_id: ex.id,
            exercise_name: ex.name,
            period: params.period,
            data_points: points,
            summary,
            best_performance: bestPoint
                ? {
                      date: bestPoint.date,
                      weight: bestPoint.max_weight,
                      reps: bestPoint.reps,
                  }
                : null,
        }
    })

    const summary: ApiAnalyticsSummaryResponse = {
        total_workouts: clamp(Math.round(dates.length / 2), 0, 200),
        total_duration: 0,
        total_exercises: exercises.length,
        current_streak: 0,
        longest_streak: 0,
        personal_records: [{ id: 1 }, { id: 2 }],
        favorite_exercises: [],
        weekly_average: 0,
        monthly_average: 0,
    }

    const trainingLoadDaily = dates
        .filter((_d, idx) => idx % 2 === 0)
        .map((date, idx) => {
            const seed = hashString(`load:${date}`)
            const volume = clamp(1800 + idx * 35 + Math.round(seeded01(seed) * 500), 800, 5000)
            const fatigueScore = clamp(45 + Math.round(seeded01(seed + 11) * 35), 20, 95)
            const avgRpe = Math.round((5.5 + seeded01(seed + 19) * 3.5) * 10) / 10
            return { date, volume, fatigueScore, avgRpe }
        })

    const muscleGroups = ['Ноги', 'Спина', 'Грудь', 'Плечи', 'Руки']
    const muscleLoad = dates.flatMap((date, idx) =>
        muscleGroups.map((muscleGroup, muscleIdx) => {
            const seed = hashString(`muscle:${muscleGroup}:${date}`)
            return {
                date,
                muscleGroup,
                loadScore: clamp(18 + idx + muscleIdx * 4 + Math.round(seeded01(seed) * 20), 5, 100),
            }
        })
    )

    const avgFatigue =
        trainingLoadDaily.length > 0
            ? trainingLoadDaily.reduce((sum, row) => sum + row.fatigueScore, 0) / trainingLoadDaily.length
            : 0
    const avgRpe =
        trainingLoadDaily.length > 0
            ? trainingLoadDaily.reduce((sum, row) => sum + (row.avgRpe ?? 0), 0) / trainingLoadDaily.length
            : 0

    const recoveryState = {
        fatigueLevel: clamp(Math.round(avgFatigue / 20), 1, 5),
        readinessScore: clamp(Math.round(100 - avgFatigue / 1.6 - avgRpe * 3), 35, 92),
    }

    return { summary, progress, trainingLoadDaily, muscleLoad, recoveryState }
}

