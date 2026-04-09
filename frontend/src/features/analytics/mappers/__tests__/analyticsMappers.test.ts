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

    // Additional edge case tests

    describe('mapProgressToExercises edge cases', () => {
        test('returns empty array for undefined input', () => {
            expect(mapProgressToExercises(undefined)).toEqual([])
        })

        test('returns empty array for empty array input', () => {
            expect(mapProgressToExercises([])).toEqual([])
        })

        test('handles exercises without best_performance field', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Deadlift',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 1, exercise_name: 'Deadlift', progress_percentage: null },
                    // best_performance is omitted
                },
            ]

            expect(mapProgressToExercises(rows)).toEqual([
                { id: 1, name: 'Deadlift', category: 'strength' },
            ])
        })
    })

    describe('buildChartDataFromProgress edge cases', () => {
        test('returns empty array when progressRows is undefined', () => {
            const result = buildChartDataFromProgress({
                progressRows: undefined,
                selectedExercises: [{ id: 1, name: 'Bench Press', category: 'strength' }],
            })
            expect(result).toEqual([])
        })

        test('returns empty array when selectedExercises is empty', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [{ date: '2026-03-01', max_weight: 80, reps: null }],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                    best_performance: null,
                },
            ]

            const result = buildChartDataFromProgress({
                progressRows: rows,
                selectedExercises: [],
            })
            expect(result).toEqual([])
        })

        test('handles single data point', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [{ date: '2026-03-15', max_weight: 100, reps: 5 }],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 0 },
                    best_performance: null,
                },
            ]

            const selected = [{ id: 1, name: 'Bench Press', category: 'strength' }]

            const result = buildChartDataFromProgress({ progressRows: rows, selectedExercises: selected })

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                date: '2026-03-15',
                formattedDate: '15.03',
                'Bench Press': 100,
            })
        })

        test('skips data points with null max_weight', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [
                        { date: '2026-03-01', max_weight: null, reps: null },
                        { date: '2026-03-02', max_weight: 80, reps: null },
                    ],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                    best_performance: null,
                },
            ]

            const selected = [{ id: 1, name: 'Bench Press', category: 'strength' }]

            const result = buildChartDataFromProgress({ progressRows: rows, selectedExercises: selected })

            expect(result).toHaveLength(1)
            expect(result[0].date).toBe('2026-03-02')
        })

        test('handles exercise not in progressRows', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [{ date: '2026-03-01', max_weight: 80, reps: null }],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                    best_performance: null,
                },
            ]

            const selected = [
                { id: 1, name: 'Bench Press', category: 'strength' },
                { id: 999, name: 'NonExistent', category: 'strength' },
            ]

            const result = buildChartDataFromProgress({ progressRows: rows, selectedExercises: selected })

            expect(result).toHaveLength(1)
            expect(result[0]['Bench Press']).toBe(80)
            expect(result[0]['NonExistent']).toBeUndefined()
        })

        test('sorts results by date ascending', () => {
            const rows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [
                        { date: '2026-03-15', max_weight: 90, reps: null },
                        { date: '2026-03-01', max_weight: 80, reps: null },
                        { date: '2026-03-10', max_weight: 85, reps: null },
                    ],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                    best_performance: null,
                },
            ]

            const selected = [{ id: 1, name: 'Bench Press', category: 'strength' }]

            const result = buildChartDataFromProgress({ progressRows: rows, selectedExercises: selected })

            expect(result[0].date).toBe('2026-03-01')
            expect(result[1].date).toBe('2026-03-10')
            expect(result[2].date).toBe('2026-03-15')
        })
    })

    describe('mapKeyMetrics edge cases', () => {
        test('handles undefined summary', () => {
            const result = mapKeyMetrics({
                summary: undefined,
                progressRows: [],
                selectedExercises: [],
            })

            expect(result).toEqual({
                totalWorkouts: 0,
                avgRestTime: 0,
                strengthGrowth: 0,
                personalRecords: 0,
            })
        })

        test('handles undefined progressRows', () => {
            const summary: ApiAnalyticsSummaryResponse = {
                total_workouts: 10,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: [],
                favorite_exercises: [],
                weekly_average: 0,
                monthly_average: 0,
            }

            const result = mapKeyMetrics({
                summary,
                progressRows: undefined,
                selectedExercises: [{ id: 1, name: 'Test', category: 'strength' }],
            })

            expect(result.totalWorkouts).toBe(10)
            expect(result.strengthGrowth).toBe(0)
            expect(result.personalRecords).toBe(0)
        })

        test('handles zero metrics', () => {
            const summary: ApiAnalyticsSummaryResponse = {
                total_workouts: 0,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: [],
                favorite_exercises: [],
                weekly_average: 0,
                monthly_average: 0,
            }

            const result = mapKeyMetrics({
                summary,
                progressRows: [],
                selectedExercises: [],
            })

            expect(result).toEqual({
                totalWorkouts: 0,
                avgRestTime: 0,
                strengthGrowth: 0,
                personalRecords: 0,
            })
        })

        test('handles null progress_percentage values', () => {
            const summary: ApiAnalyticsSummaryResponse = {
                total_workouts: 5,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: [],
                favorite_exercises: [],
                weekly_average: 0,
                monthly_average: 0,
            }

            const progressRows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Test',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 1, exercise_name: 'Test', progress_percentage: null },
                    best_performance: null,
                },
            ]

            const result = mapKeyMetrics({
                summary,
                progressRows,
                selectedExercises: [{ id: 1, name: 'Test', category: 'strength' }],
            })

            expect(result.strengthGrowth).toBe(0)
        })

        test('ignores non-finite progress_percentage values', () => {
            const summary: ApiAnalyticsSummaryResponse = {
                total_workouts: 5,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: [],
                favorite_exercises: [],
                weekly_average: 0,
                monthly_average: 0,
            }

            const progressRows: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Test1',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 1, exercise_name: 'Test1', progress_percentage: Infinity },
                    best_performance: null,
                },
                {
                    exercise_id: 2,
                    exercise_name: 'Test2',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 2, exercise_name: 'Test2', progress_percentage: NaN },
                    best_performance: null,
                },
                {
                    exercise_id: 3,
                    exercise_name: 'Test3',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 3, exercise_name: 'Test3', progress_percentage: 10 },
                    best_performance: null,
                },
            ]

            const result = mapKeyMetrics({
                summary,
                progressRows,
                selectedExercises: [
                    { id: 1, name: 'Test1', category: 'strength' },
                    { id: 2, name: 'Test2', category: 'strength' },
                    { id: 3, name: 'Test3', category: 'strength' },
                ],
            })

            // Only Test3 with progress_percentage: 10 should be counted
            expect(result.strengthGrowth).toBe(10)
        })

        test('handles personal_records as non-array', () => {
            const summary = {
                total_workouts: 5,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: null as unknown as unknown[],
                favorite_exercises: [],
                weekly_average: 0,
                monthly_average: 0,
            }

            const result = mapKeyMetrics({
                summary,
                progressRows: [],
                selectedExercises: [],
            })

            expect(result.personalRecords).toBe(0)
        })

        test('computes average strengthGrowth correctly with multiple exercises', () => {
            const summary: ApiAnalyticsSummaryResponse = {
                total_workouts: 10,
                total_duration: 0,
                total_exercises: 0,
                current_streak: 0,
                longest_streak: 0,
                personal_records: [],
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
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 15 },
                    best_performance: null,
                },
                {
                    exercise_id: 2,
                    exercise_name: 'Squat',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 2, exercise_name: 'Squat', progress_percentage: 25 },
                    best_performance: null,
                },
                {
                    exercise_id: 3,
                    exercise_name: 'Deadlift',
                    period: '30d',
                    data_points: [],
                    summary: { exercise_id: 3, exercise_name: 'Deadlift', progress_percentage: 20 },
                    best_performance: null,
                },
            ]

            const selected = [
                { id: 1, name: 'Bench Press', category: 'strength' },
                { id: 2, name: 'Squat', category: 'strength' },
                { id: 3, name: 'Deadlift', category: 'strength' },
            ]

            const result = mapKeyMetrics({ summary, progressRows, selectedExercises: selected })

            // Average of 15, 25, 20 = 20
            expect(result.strengthGrowth).toBe(20)
        })
    })
})

