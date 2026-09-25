import { findPreviousResult, formatPreviousSetLine } from '../previousResult'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

function makeHistoryItem(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
    return {
        id: 5,
        date: '2026-09-09',
        duration: 50,
        comments: 'Push A',
        tags: ['strength'],
        created_at: '2026-09-09T10:00:00Z',
        exercises: [
            {
                exercise_id: 10,
                name: 'Bench Press',
                sets_completed: [
                    { set_number: 1, set_type: 'warmup', reps: 15, weight: 40, completed: true },
                    { set_number: 2, set_type: 'working', reps: 10, weight: 80, completed: true, rpe: 7.5 },
                    { set_number: 3, set_type: 'working', reps: 9, weight: 80, completed: true, rpe: 8 },
                ],
            },
        ],
        ...overrides,
    }
}

describe('previous result (SPEC-005 §8)', () => {
    it('excludes warm-up sets from the working previous result', () => {
        const result = findPreviousResult([makeHistoryItem()], 99, { exercise_id: 10, name: 'Bench Press' })
        expect(result).not.toBeNull()
        expect(result!.sets).toHaveLength(2)
        expect(result!.sets.every((set) => set.set_type !== 'warmup')).toBe(true)
        expect(result!.sessionId).toBe(5)
    })

    it('reports volume and RPE from working sets only', () => {
        const result = findPreviousResult([makeHistoryItem()], 99, { exercise_id: 10, name: 'Bench Press' })
        // 80*10 + 80*9 = 1520 (warm-up 40*15 excluded)
        expect(result!.volume).toBe(1520)
        expect(result!.rpeValues).toEqual([7.5, 8])
    })

    it('ignores the current session and incomplete workouts', () => {
        const current = makeHistoryItem({ id: 42 })
        expect(findPreviousResult([current], 42, { exercise_id: 10, name: 'Bench Press' })).toBeNull()

        const incomplete = makeHistoryItem({ id: 7, duration: undefined })
        expect(findPreviousResult([incomplete], 42, { exercise_id: 10, name: 'Bench Press' })).toBeNull()
    })

    it('returns null when there is no history (first time performing)', () => {
        expect(findPreviousResult([], 1, { exercise_id: 10, name: 'Bench Press' })).toBeNull()
        expect(findPreviousResult(undefined, 1, { exercise_id: 10, name: 'Bench Press' })).toBeNull()
    })

    it('matches by name when the exercise ids differ', () => {
        const result = findPreviousResult([makeHistoryItem()], 99, { exercise_id: 777, name: '  bench press ' })
        expect(result).not.toBeNull()
        expect(result!.sets).toHaveLength(2)
    })

    it('formats weight × reps and timed sets', () => {
        expect(formatPreviousSetLine({ set_number: 1, weight: 80, reps: 10, completed: true })).toBe('80 × 10')
        expect(formatPreviousSetLine({ set_number: 1, duration: 60, completed: true })).toBe('60 сек')
    })

    it('treats a missing set_type as a working set and skips uncompleted ones', () => {
        const item = makeHistoryItem({
            exercises: [
                {
                    exercise_id: 10,
                    name: 'Bench Press',
                    sets_completed: [
                        { set_number: 1, reps: 5, weight: 50, completed: true },
                        { set_number: 2, reps: 5, weight: 50, completed: false },
                    ],
                },
            ],
        })

        const result = findPreviousResult([item], 99, { exercise_id: 10, name: 'Bench Press' })

        expect(result!.sets).toHaveLength(1)
        expect(result!.volume).toBe(250)
    })
})
