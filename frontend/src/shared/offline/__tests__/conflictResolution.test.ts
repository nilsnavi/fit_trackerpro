import {
    exercisesSignificantlyDifferent,
    mergeConflictedWorkout,
} from '../conflictResolution'
import type { WorkoutHistoryItem, CompletedExercise } from '@features/workouts/types/workouts'

function makeExercise(overrides: Partial<CompletedExercise> = {}): CompletedExercise {
    return {
        exercise_id: 1,
        name: 'Squat',
        sets_completed: [
            { set_number: 1, reps: 10, weight: 80, completed: true },
        ],
        ...overrides,
    }
}

function makeWorkout(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
    return {
        id: 1,
        date: '2026-04-09',
        duration: 60,
        exercises: [makeExercise()],
        comments: 'Test workout',
        tags: ['strength'],
        glucose_before: undefined,
        glucose_after: undefined,
        created_at: '2026-04-09T10:00:00Z',
        ...overrides,
    }
}

describe('exercisesSignificantlyDifferent', () => {
    it('returns true when exercise arrays have different lengths', () => {
        const local = [makeExercise(), makeExercise({ exercise_id: 2, name: 'Bench' })]
        const server = [makeExercise()]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(true)
    })

    it('returns true when exercise names differ', () => {
        const local = [makeExercise({ name: 'Squat' })]
        const server = [makeExercise({ name: 'Deadlift' })]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(true)
    })

    it('returns true when set weight differs', () => {
        const local = [makeExercise({ sets_completed: [{ set_number: 1, reps: 10, weight: 80, completed: true }] })]
        const server = [makeExercise({ sets_completed: [{ set_number: 1, reps: 10, weight: 100, completed: true }] })]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(true)
    })

    it('returns true when set reps differ', () => {
        const local = [makeExercise({ sets_completed: [{ set_number: 1, reps: 8, weight: 80, completed: true }] })]
        const server = [makeExercise({ sets_completed: [{ set_number: 1, reps: 12, weight: 80, completed: true }] })]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(true)
    })

    it('returns true when completed flag differs', () => {
        const local = [makeExercise({ sets_completed: [{ set_number: 1, reps: 10, weight: 80, completed: false }] })]
        const server = [makeExercise({ sets_completed: [{ set_number: 1, reps: 10, weight: 80, completed: true }] })]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(true)
    })

    it('returns false when exercises are identical', () => {
        const local = [makeExercise()]
        const server = [makeExercise()]
        expect(exercisesSignificantlyDifferent(local, server)).toBe(false)
    })
})

describe('mergeConflictedWorkout', () => {
    it('preserves local exercises, comments, tags, and glucose values', () => {
        const local = makeWorkout({
            exercises: [makeExercise({ name: 'Local Squat' })],
            comments: 'Local comment',
            tags: ['local'],
            glucose_before: 5.5,
            glucose_after: 6.0,
        })
        const server = makeWorkout({
            id: 1,
            exercises: [makeExercise({ name: 'Server Squat' })],
            comments: 'Server comment',
            tags: ['server'],
            duration: 90,
        })

        const result = mergeConflictedWorkout(local, server)

        expect(result.exercises).toEqual(local.exercises)
        expect(result.comments).toBe('Local comment')
        expect(result.tags).toEqual(['local'])
        expect(result.glucose_before).toBe(5.5)
        expect(result.glucose_after).toBe(6.0)
    })

    it('takes non-exercise fields (duration, date, created_at) from server', () => {
        const local = makeWorkout({ duration: 30 })
        const server = makeWorkout({ duration: 90, date: '2026-04-10', created_at: '2026-04-10T08:00:00Z' })

        const result = mergeConflictedWorkout(local, server)

        expect(result.duration).toBe(90)
        expect(result.date).toBe('2026-04-10')
        expect(result.created_at).toBe('2026-04-10T08:00:00Z')
    })
})
