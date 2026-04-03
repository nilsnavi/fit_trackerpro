import {
    mapEditorExercisesToTemplate,
    mapEditorExercisesToCompleted,
} from '../workoutModeEditorMappers'
import type { WorkoutModeExerciseItem } from '@features/workouts/workoutMode/workoutModeEditorTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function strengthItem(overrides?: Partial<WorkoutModeExerciseItem>): WorkoutModeExerciseItem {
    return {
        id: 's-1',
        exerciseId: 10,
        name: 'Жим лёжа',
        mode: 'strength',
        params: { sets: 4, reps: 8, weight: 80, restSeconds: 120, note: 'Медленно' },
        ...overrides,
    }
}

function cardioItem(overrides?: Partial<WorkoutModeExerciseItem>): WorkoutModeExerciseItem {
    return {
        id: 'c-1',
        exerciseId: 20,
        name: 'Бег',
        mode: 'cardio',
        params: { durationSeconds: 1800, distance: 5, intensity: 'medium', note: 'Пульс 140' },
        ...overrides,
    }
}

function functionalItem(overrides?: Partial<WorkoutModeExerciseItem>): WorkoutModeExerciseItem {
    return {
        id: 'f-1',
        exerciseId: 30,
        name: 'Бёрпи',
        mode: 'functional',
        params: { rounds: 5, reps: 10, restSeconds: 30, note: '30с отдых' },
        ...overrides,
    }
}

function yogaItem(overrides?: Partial<WorkoutModeExerciseItem>): WorkoutModeExerciseItem {
    return {
        id: 'y-1',
        exerciseId: 40,
        name: 'Поза собаки',
        mode: 'yoga',
        params: { durationSeconds: 60, note: 'Дышать глубоко' },
        ...overrides,
    }
}

// ── mapEditorExercisesToTemplate ──────────────────────────────────────────────

describe('mapEditorExercisesToTemplate()', () => {
    it('maps strength correctly', () => {
        const [ex] = mapEditorExercisesToTemplate([strengthItem()])
        expect(ex).toMatchObject({
            exercise_id: 10,
            name: 'Жим лёжа',
            sets: 4,
            reps: 8,
            weight: 80,
            rest_seconds: 120,
            notes: 'Медленно',
        })
    })

    it('maps cardio correctly (sets=1, rest_seconds=0)', () => {
        const [ex] = mapEditorExercisesToTemplate([cardioItem()])
        expect(ex).toMatchObject({
            exercise_id: 20,
            name: 'Бег',
            sets: 1,
            duration: 1800,
            rest_seconds: 0,
            notes: 'Пульс 140',
        })
        expect(ex.reps).toBeUndefined()
    })

    it('maps functional with reps (no duration)', () => {
        const [ex] = mapEditorExercisesToTemplate([functionalItem()])
        expect(ex).toMatchObject({
            exercise_id: 30,
            sets: 5, // rounds → sets
            reps: 10,
            rest_seconds: 30,
        })
        expect(ex.duration).toBeUndefined()
    })

    it('maps functional with duration (no reps)', () => {
        const item = functionalItem()
        ;(item.params as any).reps = undefined
        ;(item.params as any).durationSeconds = 40
        const [ex] = mapEditorExercisesToTemplate([item])
        expect(ex.duration).toBe(40)
        expect(ex.reps).toBeUndefined()
    })

    it('maps yoga correctly (sets=1, rest_seconds=0)', () => {
        const [ex] = mapEditorExercisesToTemplate([yogaItem()])
        expect(ex).toMatchObject({
            exercise_id: 40,
            sets: 1,
            duration: 60,
            rest_seconds: 0,
            notes: 'Дышать глубоко',
        })
    })

    it('returns empty array for empty input', () => {
        expect(mapEditorExercisesToTemplate([])).toHaveLength(0)
    })

    it('preserves order of multiple exercises', () => {
        const result = mapEditorExercisesToTemplate([strengthItem(), cardioItem(), yogaItem()])
        expect(result.map((e) => e.exercise_id)).toEqual([10, 20, 40])
    })

    it('omits weight when undefined for strength', () => {
        const item = strengthItem()
        ;(item.params as any).weight = undefined
        const [ex] = mapEditorExercisesToTemplate([item])
        expect(ex.weight).toBeUndefined()
    })

    it('omits note when undefined', () => {
        const item = strengthItem()
        ;(item.params as any).note = undefined
        const [ex] = mapEditorExercisesToTemplate([item])
        expect(ex.notes).toBeUndefined()
    })
})

// ── mapEditorExercisesToCompleted ────────────────────────────────────────────

describe('mapEditorExercisesToCompleted()', () => {
    it('creates correct sets_completed for strength', () => {
        const [ex] = mapEditorExercisesToCompleted([strengthItem()])
        expect(ex.sets_completed).toHaveLength(4)
        expect(ex.sets_completed[0]).toMatchObject({
            set_number: 1,
            reps: 8,
            weight: 80,
            completed: false,
        })
        expect(ex.sets_completed[3].set_number).toBe(4)
    })

    it('strength sets are not completed by default', () => {
        const [ex] = mapEditorExercisesToCompleted([strengthItem()])
        expect(ex.sets_completed.every((s) => s.completed === false)).toBe(true)
    })

    it('creates single set for cardio with duration and distance', () => {
        const [ex] = mapEditorExercisesToCompleted([cardioItem()])
        expect(ex.sets_completed).toHaveLength(1)
        expect(ex.sets_completed[0]).toMatchObject({
            set_number: 1,
            duration: 1800,
            distance: 5,
            completed: false,
        })
    })

    it('creates rounds sets for functional (reps variant)', () => {
        const [ex] = mapEditorExercisesToCompleted([functionalItem()])
        expect(ex.sets_completed).toHaveLength(5)
        expect(ex.sets_completed[0]).toMatchObject({
            set_number: 1,
            reps: 10,
            completed: false,
        })
    })

    it('creates rounds sets for functional (duration variant)', () => {
        const item = functionalItem()
        ;(item.params as any).reps = undefined
        ;(item.params as any).durationSeconds = 40
        const [ex] = mapEditorExercisesToCompleted([item])
        expect(ex.sets_completed[0].duration).toBe(40)
        expect(ex.sets_completed[0].reps).toBeUndefined()
    })

    it('creates single set for yoga', () => {
        const [ex] = mapEditorExercisesToCompleted([yogaItem()])
        expect(ex.sets_completed).toHaveLength(1)
        expect(ex.sets_completed[0]).toMatchObject({ set_number: 1, duration: 60, completed: false })
    })

    it('preserves notes on exercise', () => {
        const [ex] = mapEditorExercisesToCompleted([strengthItem()])
        expect(ex.notes).toBe('Медленно')
    })
})
