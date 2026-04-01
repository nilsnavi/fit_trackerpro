import {
    buildChartDataFromProgress,
    mapKeyMetrics,
    mapProgressToExercises,
    type ApiAnalyticsSummaryResponse,
    type ApiExerciseProgressResponse,
} from '../analyticsMappers'

describe('analytics mappers', () => {
    test('mapProgressToExercises maps backend progress rows to UI exercises', () => {
        const rows: ApiExerciseProgressResponse[] = [
            {
                exercise_id: 10,
                exercise_name: 'Bench Press',
                period: '30d',
                data_points: [],
                summary: { exercise_id: 10, exercise_name: 'Bench Press', progress_percentage: 12 },
                best_performance: null,
            },
            {
                exercise_id: 11,
                exercise_name: 'Squat',
                period: '30d',
                data_points: [],
                summary: { exercise_id: 11, exercise_name: 'Squat', progress_percentage: null },
                best_performance: null,
            },
        ]

        expect(mapProgressToExercises(rows)).toEqual([
            { id: 10, name: 'Bench Press', category: 'strength' },
            { id: 11, name: 'Squat', category: 'strength' },
        ])
    })

    test('buildChartDataFromProgress builds date-keyed series for selected exercises', () => {
        const rows: ApiExerciseProgressResponse[] = [
            {
                exercise_id: 1,
                exercise_name: 'Bench Press',
                period: '30d',
                data_points: [
                    { date: '2026-03-01', max_weight: 80, reps: null },
                    { date: '2026-03-02', max_weight: null, reps: null },
                    { date: '2026-03-03', max_weight: 82.5, reps: null },
                ],
                summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                best_performance: null,
            },
            {
                exercise_id: 2,
                exercise_name: 'Squat',
                period: '30d',
                data_points: [
                    { date: '2026-03-01', max_weight: 120, reps: null },
                    { date: '2026-03-03', max_weight: 125, reps: null },
                ],
                summary: { exercise_id: 2, exercise_name: 'Squat', progress_percentage: 4 },
                best_performance: null,
            },
        ]

        const selected = [
            { id: 1, name: 'Bench Press', category: 'strength' },
            { id: 2, name: 'Squat', category: 'strength' },
        ]

        const data = buildChartDataFromProgress({ progressRows: rows, selectedExercises: selected })

        expect(data).toEqual([
            { date: '2026-03-01', formattedDate: '01.03', 'Bench Press': 80, Squat: 120 },
            { date: '2026-03-03', formattedDate: '03.03', 'Bench Press': 82.5, Squat: 125 },
        ])
    })

    test('mapKeyMetrics computes strengthGrowth as average progress_percentage over selected exercises', () => {
        const summary: ApiAnalyticsSummaryResponse = {
            total_workouts: 42,
            total_duration: 0,
            total_exercises: 0,
            current_streak: 0,
            longest_streak: 0,
            personal_records: [{ id: 1 }, { id: 2 }, { id: 3 }],
            favorite_exercises: [],
            weekly_average: 0,
            monthly_average: 0,
        }

        const progressRows: ApiExerciseProgressResponse[] = [
            {
                exercise_id: 1,
                exercise_name: 'Bench Press',
                period: '30d',
                data_points: [],
                summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 10 },
                best_performance: null,
            },
            {
                exercise_id: 2,
                exercise_name: 'Squat',
                period: '30d',
                data_points: [],
                summary: { exercise_id: 2, exercise_name: 'Squat', progress_percentage: 5 },
                best_performance: null,
            },
        ]

        const selected = [
            { id: 1, name: 'Bench Press', category: 'strength' },
            { id: 2, name: 'Squat', category: 'strength' },
        ]

        expect(mapKeyMetrics({ summary, progressRows, selectedExercises: selected })).toEqual({
            totalWorkouts: 42,
            avgRestTime: 0,
            strengthGrowth: 8,
            personalRecords: 3,
        })
    })
})

