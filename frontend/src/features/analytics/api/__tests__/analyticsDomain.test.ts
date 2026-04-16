/**
 * Contract tests for analyticsDomain API types
 *
 * These tests verify that API response types correctly handle:
 * - Normal server responses with data
 * - Empty responses (no workouts - empty arrays, zero counters)
 * - Partial data (some fields null/undefined)
 * - Edge cases
 *
 * NOTE: These are contract tests for type shapes, not actual API calls.
 */

import type {
    ApiAnalyticsSummaryResponse,
    ApiExerciseProgressResponse,
    ApiExerciseProgressPoint,
    ApiProgressInsightsResponse,
    ApiAnalyticsPerformanceOverviewResponse,
    ApiTrainingLoadDailyEntry,
    ApiMuscleLoadEntry,
    ApiRecoveryStateResponse,
    ApiWorkoutPostSummaryResponse,
} from '../analyticsDomain'

describe('analyticsDomain API types contract tests', () => {
    describe('ApiAnalyticsSummaryResponse', () => {
        test('accepts complete response with all fields', () => {
            const response: ApiAnalyticsSummaryResponse = {
                total_workouts: 42,
                total_duration: 3600,
                total_exercises: 150,
                current_streak: 7,
                longest_streak: 14,
                personal_records: [{ id: 1, exercise: 'Bench Press', weight: 100 }],
                favorite_exercises: [{ id: 1, name: 'Squat', count: 10 }],
                weekly_average: 3.5,
                monthly_average: 14,
            }

            expect(response.total_workouts).toBe(42)
            expect(response.current_streak).toBe(7)
            expect(response.personal_records).toHaveLength(1)
        })

        test('accepts empty response with zero values', () => {
            const response: ApiAnalyticsSummaryResponse = {
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

            expect(response.total_workouts).toBe(0)
            expect(response.personal_records).toEqual([])
            expect(response.favorite_exercises).toEqual([])
        })

        test('accepts response with minimal required fields', () => {
            // Simulating API response with only required fields
            const response: ApiAnalyticsSummaryResponse = {
                total_workouts: 1,
                total_duration: 0,
                total_exercises: 1,
                current_streak: 1,
                longest_streak: 1,
                personal_records: [],
                favorite_exercises: [],
                weekly_average: 1,
                monthly_average: 1,
            }

            expect(response.total_workouts).toBe(1)
        })
    })

    describe('ApiExerciseProgressResponse', () => {
        test('accepts complete progress response', () => {
            const response: ApiExerciseProgressResponse = {
                exercise_id: 1,
                exercise_name: 'Bench Press',
                period: '30d',
                data_points: [
                    { date: '2026-03-01', max_weight: 80, reps: 5 },
                    { date: '2026-03-02', max_weight: 82.5, reps: 4 },
                ],
                summary: {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    progress_percentage: 5.5,
                },
                best_performance: {
                    date: '2026-03-02',
                    weight: 82.5,
                    reps: 4,
                },
            }

            expect(response.exercise_id).toBe(1)
            expect(response.data_points).toHaveLength(2)
            expect(response.best_performance?.weight).toBe(82.5)
        })

        test('accepts response with null best_performance', () => {
            const response: ApiExerciseProgressResponse = {
                exercise_id: 1,
                exercise_name: 'New Exercise',
                period: '30d',
                data_points: [],
                summary: {
                    exercise_id: 1,
                    exercise_name: 'New Exercise',
                    progress_percentage: null,
                },
                best_performance: null,
            }

            expect(response.best_performance).toBeNull()
        })

        test('accepts response without best_performance field', () => {
            const response: ApiExerciseProgressResponse = {
                exercise_id: 1,
                exercise_name: 'Exercise',
                period: '30d',
                data_points: [],
                summary: {
                    exercise_id: 1,
                    exercise_name: 'Exercise',
                    progress_percentage: null,
                },
            }

            expect(response.best_performance).toBeUndefined()
        })

        test('accepts empty data_points array', () => {
            const response: ApiExerciseProgressResponse = {
                exercise_id: 1,
                exercise_name: 'Exercise',
                period: '30d',
                data_points: [],
                summary: {
                    exercise_id: 1,
                    exercise_name: 'Exercise',
                    progress_percentage: null,
                },
                best_performance: null,
            }

            expect(response.data_points).toEqual([])
        })
    })

    describe('ApiExerciseProgressPoint', () => {
        test('accepts point with complete data', () => {
            const point: ApiExerciseProgressPoint = {
                date: '2026-03-01',
                max_weight: 100,
                reps: 5,
            }

            expect(point.date).toBe('2026-03-01')
            expect(point.max_weight).toBe(100)
            expect(point.reps).toBe(5)
        })

        test('accepts point with null values', () => {
            const point: ApiExerciseProgressPoint = {
                date: '2026-03-01',
                max_weight: null,
                reps: null,
            }

            expect(point.max_weight).toBeNull()
            expect(point.reps).toBeNull()
        })

        test('accepts point with mixed null and number values', () => {
            const point1: ApiExerciseProgressPoint = {
                date: '2026-03-01',
                max_weight: 100,
                reps: null,
            }

            const point2: ApiExerciseProgressPoint = {
                date: '2026-03-02',
                max_weight: null,
                reps: 5,
            }

            expect(point1.max_weight).toBe(100)
            expect(point2.reps).toBe(5)
        })
    })

    describe('ApiProgressInsightsResponse', () => {
        test('accepts complete insights response', () => {
            const response: ApiProgressInsightsResponse = {
                period: '30d',
                date_from: '2026-03-01',
                date_to: '2026-03-30',
                summary: {
                    total_workouts: 12,
                    active_days: 10,
                    total_sets: 120,
                    total_reps: 600,
                    total_volume: 45000,
                    average_workouts_per_week: 3,
                },
                volume_trend: [
                    { date: '2026-03-01', workout_count: 1, total_sets: 10, total_reps: 50, total_volume: 1000 },
                ],
                frequency_trend: [
                    { week_start: '2026-03-01', week_end: '2026-03-07', active_days: 3, workout_count: 3 },
                ],
                best_sets: [
                    { exercise_id: 1, exercise_name: 'Bench Press', date: '2026-03-15', set_number: 1, weight: 100, reps: 5, volume: 500 },
                ],
                pr_events: [
                    {
                        exercise_id: 1,
                        exercise_name: 'Bench Press',
                        date: '2026-03-15',
                        weight: 100,
                        reps: 5,
                        previous_best_weight: 95,
                        improvement: 5,
                        improvement_pct: 5.26,
                        is_first_entry: false,
                    },
                ],
            }

            expect(response.summary.total_workouts).toBe(12)
            expect(response.pr_events).toHaveLength(1)
        })

        test('accepts empty insights response', () => {
            const response: ApiProgressInsightsResponse = {
                period: '30d',
                date_from: '2026-03-01',
                date_to: '2026-03-30',
                summary: {
                    total_workouts: 0,
                    active_days: 0,
                    total_sets: 0,
                    total_reps: 0,
                    total_volume: 0,
                    average_workouts_per_week: 0,
                },
                volume_trend: [],
                frequency_trend: [],
                best_sets: [],
                pr_events: [],
            }

            expect(response.summary.total_workouts).toBe(0)
            expect(response.volume_trend).toEqual([])
            expect(response.pr_events).toEqual([])
        })
    })

    describe('ApiAnalyticsPerformanceOverviewResponse', () => {
        test('accepts complete performance overview', () => {
            const response: ApiAnalyticsPerformanceOverviewResponse = {
                period: '30d',
                date_from: '2026-03-01',
                date_to: '2026-03-30',
                total_workouts: 12,
                active_days: 10,
                average_workouts_per_week: 2.8,
                total_volume: 45000,
                average_volume_per_workout: 3750,
                baseline_estimated_1rm: 100,
                current_estimated_1rm: 110,
                estimated_1rm_progress_pct: 10,
                trend: [
                    { date: '2026-03-01', workout_count: 1, total_volume: 1000, best_estimated_1rm: 100 },
                ],
            }

            expect(response.total_workouts).toBe(12)
            expect(response.estimated_1rm_progress_pct).toBe(10)
        })

        test('accepts response with null estimated 1rm values', () => {
            const response: ApiAnalyticsPerformanceOverviewResponse = {
                period: '30d',
                date_from: '2026-03-01',
                date_to: '2026-03-30',
                total_workouts: 0,
                active_days: 0,
                average_workouts_per_week: 0,
                total_volume: 0,
                average_volume_per_workout: 0,
                baseline_estimated_1rm: null,
                current_estimated_1rm: null,
                estimated_1rm_progress_pct: null,
                trend: [],
            }

            expect(response.baseline_estimated_1rm).toBeNull()
            expect(response.current_estimated_1rm).toBeNull()
            expect(response.estimated_1rm_progress_pct).toBeNull()
        })
    })

    describe('ApiTrainingLoadDailyEntry', () => {
        test('accepts complete daily entry', () => {
            const entry: ApiTrainingLoadDailyEntry = {
                date: '2026-03-15',
                volume: 5000,
                fatigueScore: 75,
                avgRpe: 8.5,
            }

            expect(entry.date).toBe('2026-03-15')
            expect(entry.fatigueScore).toBe(75)
        })

        test('accepts entry with null avgRpe', () => {
            const entry: ApiTrainingLoadDailyEntry = {
                date: '2026-03-15',
                volume: 5000,
                fatigueScore: 50,
                avgRpe: null,
            }

            expect(entry.avgRpe).toBeNull()
        })
    })

    describe('ApiMuscleLoadEntry', () => {
        test('accepts complete muscle load entry', () => {
            const entry: ApiMuscleLoadEntry = {
                date: '2026-03-15',
                muscleGroup: 'chest',
                loadScore: 85,
            }

            expect(entry.muscleGroup).toBe('chest')
            expect(entry.loadScore).toBe(85)
        })
    })

    describe('ApiRecoveryStateResponse', () => {
        test('accepts complete recovery state', () => {
            const response: ApiRecoveryStateResponse = {
                id: 1,
                userId: 42,
                fatigueLevel: 30,
                readinessScore: 75,
            }

            expect(response.fatigueLevel).toBe(30)
            expect(response.readinessScore).toBe(75)
        })

        test('accepts zero recovery values', () => {
            const response: ApiRecoveryStateResponse = {
                id: 1,
                userId: 42,
                fatigueLevel: 0,
                readinessScore: 0,
            }

            expect(response.fatigueLevel).toBe(0)
            expect(response.readinessScore).toBe(0)
        })
    })

    describe('ApiWorkoutPostSummaryResponse', () => {
        test('accepts complete workout summary', () => {
            const response: ApiWorkoutPostSummaryResponse = {
                workout_id: 123,
                date: '2026-03-15',
                duration: 3600,
                total_sets: 20,
                total_reps: 100,
                total_volume: 5000,
                best_sets: [
                    { exercise_id: 1, exercise_name: 'Bench Press', date: '2026-03-15', set_number: 1, weight: 100, reps: 5, volume: 500 },
                ],
                pr_events: [],
            }

            expect(response.workout_id).toBe(123)
            expect(response.total_volume).toBe(5000)
        })

        test('accepts workout summary with empty arrays', () => {
            const response: ApiWorkoutPostSummaryResponse = {
                workout_id: 123,
                date: '2026-03-15',
                duration: 1800,
                total_sets: 10,
                total_reps: 50,
                total_volume: 2000,
                best_sets: [],
                pr_events: [],
            }

            expect(response.best_sets).toEqual([])
            expect(response.pr_events).toEqual([])
        })
    })

    describe('Type safety and structure validation', () => {
        test('ApiExerciseProgressResponse array handles multiple exercises', () => {
            const responses: ApiExerciseProgressResponse[] = [
                {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    period: '30d',
                    data_points: [{ date: '2026-03-01', max_weight: 80, reps: 5 }],
                    summary: { exercise_id: 1, exercise_name: 'Bench Press', progress_percentage: 5 },
                },
                {
                    exercise_id: 2,
                    exercise_name: 'Squat',
                    period: '30d',
                    data_points: [{ date: '2026-03-01', max_weight: 120, reps: 5 }],
                    summary: { exercise_id: 2, exercise_name: 'Squat', progress_percentage: 10 },
                },
            ]

            expect(responses).toHaveLength(2)
            expect(responses[0].exercise_name).toBe('Bench Press')
            expect(responses[1].exercise_name).toBe('Squat')
        })

        test('handles date string format correctly', () => {
            const point: ApiExerciseProgressPoint = {
                date: '2026-03-15',
                max_weight: 100,
                reps: 5,
            }

            // Verify date format is yyyy-mm-dd
            expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        test('handles floating point numbers for weights', () => {
            const point: ApiExerciseProgressPoint = {
                date: '2026-03-15',
                max_weight: 82.5,
                reps: 5,
            }

            expect(point.max_weight).toBeCloseTo(82.5)
        })

        test('handles negative progress percentage (strength loss)', () => {
            const response: ApiExerciseProgressResponse = {
                exercise_id: 1,
                exercise_name: 'Bench Press',
                period: '30d',
                data_points: [],
                summary: {
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    progress_percentage: -5.5,
                },
            }

            expect(response.summary.progress_percentage).toBe(-5.5)
        })
    })
})
