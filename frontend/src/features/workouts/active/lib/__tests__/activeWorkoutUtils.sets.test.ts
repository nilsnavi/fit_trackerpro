import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import {
    appendPrefilledSet,
    DEFAULT_TIMED_SET_SECONDS,
    isTimedSet,
} from '../activeWorkoutUtils'

function set(overrides: Partial<CompletedSet>): CompletedSet {
    return { set_number: 1, completed: false, ...overrides }
}

function exercise(sets: CompletedSet[]): CompletedExercise {
    return { exercise_id: 1, name: 'Жим лёжа', sets_completed: sets }
}

describe('isTimedSet (SPEC-005 §20)', () => {
    it('treats a set with duration and no reps as timed', () => {
        expect(isTimedSet(set({ duration: 45 }))).toBe(true)
    })

    it('treats the reps=0 the server stores for timed sets as timed', () => {
        expect(isTimedSet(set({ duration: 45, reps: 0 }))).toBe(true)
    })

    it('is false for a reps-based set', () => {
        expect(isTimedSet(set({ reps: 10, weight: 80 }))).toBe(false)
    })

    it('is false when a duration is recorded alongside reps', () => {
        expect(isTimedSet(set({ reps: 10, duration: 45 }))).toBe(false)
    })

    it('is false for an empty set', () => {
        expect(isTimedSet(set({}))).toBe(false)
    })
})

describe('appendPrefilledSet (SPEC-005 §11)', () => {
    it('appends a set copied from the previous working set', () => {
        const result = appendPrefilledSet(exercise([
            set({ set_number: 1, set_type: 'working', weight: 80, reps: 10, completed: true }),
        ]))

        expect(result.sets_completed).toHaveLength(2)
        expect(result.sets_completed[1]).toMatchObject({
            set_number: 2,
            set_type: 'working',
            weight: 80,
            reps: 10,
            completed: false,
        })
    })

    it('copies reps, never duration, from a reps-based source', () => {
        const result = appendPrefilledSet(exercise([
            set({ set_number: 1, set_type: 'working', weight: 60, reps: 12, completed: true }),
        ]))

        expect(result.sets_completed[1].reps).toBe(12)
        expect(result.sets_completed[1].duration).toBeUndefined()
    })

    it('copies duration instead of reps from a timed source', () => {
        const result = appendPrefilledSet(exercise([
            set({ set_number: 1, set_type: 'working', duration: DEFAULT_TIMED_SET_SECONDS, completed: true }),
        ]))

        expect(result.sets_completed[1].duration).toBe(DEFAULT_TIMED_SET_SECONDS)
        expect(result.sets_completed[1].reps).toBeUndefined()
    })

    it('prefers the last working set over a trailing warm-up', () => {
        const result = appendPrefilledSet(exercise([
            set({ set_number: 1, set_type: 'working', weight: 80, reps: 8, completed: true }),
            set({ set_number: 2, set_type: 'warmup', weight: 40, reps: 15, completed: true }),
        ]))

        expect(result.sets_completed[2]).toMatchObject({
            set_number: 3,
            set_type: 'working',
            weight: 80,
            reps: 8,
        })
    })

    it('falls back to a default rep target for an empty exercise', () => {
        const result = appendPrefilledSet(exercise([]))

        expect(result.sets_completed).toEqual([
            expect.objectContaining({ set_number: 1, set_type: 'working', reps: 10, completed: false }),
        ])
    })

    it('does not mutate the source exercise', () => {
        const source = exercise([set({ set_number: 1, set_type: 'working', reps: 10 })])

        appendPrefilledSet(source)

        expect(source.sets_completed).toHaveLength(1)
    })
})
