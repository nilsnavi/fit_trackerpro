import { format, parseISO } from 'date-fns'

export type ApiDate = string // yyyy-mm-dd

export type ApiExerciseProgressPoint = {
    date: ApiDate
    max_weight: number | null
    reps: number | null
}

export type ApiExerciseProgressSummary = {
    exercise_id: number
    exercise_name: string
    progress_percentage: number | null
}

export type ApiExerciseProgressResponse = {
    exercise_id: number
    exercise_name: string
    period: string
    data_points: ApiExerciseProgressPoint[]
    summary: ApiExerciseProgressSummary
    best_performance?:
        | {
              date: ApiDate
              weight: number | null
              reps: number | null
          }
        | null
}

export type ApiAnalyticsSummaryResponse = {
    total_workouts: number
    total_duration: number
    total_exercises: number
    current_streak: number
    longest_streak: number
    personal_records: unknown[]
    favorite_exercises: unknown[]
    weekly_average: number
    monthly_average: number
}

export interface Exercise {
    id: number
    name: string
    category: string
}

export interface ChartDataPoint {
    date: string
    formattedDate: string
    [exerciseName: string]: number | string
}

export interface KeyMetrics {
    totalWorkouts: number
    avgRestTime: number
    strengthGrowth: number
    personalRecords: number
}

export function mapProgressToExercises(rows: ApiExerciseProgressResponse[] | undefined): Exercise[] {
    return (rows ?? []).map((r) => ({
        id: r.exercise_id,
        name: r.exercise_name,
        category: 'strength',
    }))
}

export function buildChartDataFromProgress(params: {
    progressRows: ApiExerciseProgressResponse[] | undefined
    selectedExercises: Exercise[]
}): ChartDataPoint[] {
    const { progressRows, selectedExercises } = params
    const dataMap = new Map<string, ChartDataPoint>()
    const byId = new Map<number, ApiExerciseProgressResponse>()
    for (const r of progressRows ?? []) byId.set(r.exercise_id, r)

    for (const ex of selectedExercises) {
        const row = byId.get(ex.id)
        if (!row) continue
        for (const p of row.data_points ?? []) {
            const iso = String(p.date)
            if (typeof p.max_weight === 'number') {
                const formattedDate = format(parseISO(iso), 'dd.MM')
                if (!dataMap.has(iso)) {
                    dataMap.set(iso, { date: iso, formattedDate })
                }
                const point = dataMap.get(iso)!
                point[ex.name] = p.max_weight
            }
        }
    }

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function mapKeyMetrics(params: {
    summary: ApiAnalyticsSummaryResponse | undefined
    progressRows: ApiExerciseProgressResponse[] | undefined
    selectedExercises: Exercise[]
}): KeyMetrics {
    const { summary, progressRows, selectedExercises } = params
    const totalWorkouts = summary?.total_workouts ?? 0
    const avgRestTime = 0

    const progressById = new Map<number, ApiExerciseProgressResponse>()
    for (const r of progressRows ?? []) progressById.set(r.exercise_id, r)

    const values: number[] = []
    for (const ex of selectedExercises) {
        const v = progressById.get(ex.id)?.summary?.progress_percentage
        if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
    }
    const strengthGrowth =
        values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0

    const personalRecords = Array.isArray(summary?.personal_records) ? summary!.personal_records.length : 0

    return { totalWorkouts, avgRestTime, strengthGrowth, personalRecords }
}

