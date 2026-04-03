import { useWorkoutModeEditorStore } from '../useWorkoutModeEditorStore'
import type { WorkoutModeExerciseItem } from '@features/workouts/workoutMode/workoutModeEditorTypes'

const store = () => useWorkoutModeEditorStore.getState()

// Helper: build a minimal exercise item
function makeExercise(id: string, name = 'Bench Press'): WorkoutModeExerciseItem {
    return {
        id,
        exerciseId: 1,
        name,
        mode: 'strength',
        params: { sets: 3, reps: 10, restSeconds: 60 },
    }
}

beforeEach(() => {
    store().reset()
})

// ── validate() ───────────────────────────────────────────────────────────────

describe('validate()', () => {
    it('returns false and sets title error when title is empty', () => {
        store().setMode('strength')
        const ok = store().validate()
        expect(ok).toBe(false)
        expect(store().validationErrors.title).toBeTruthy()
    })

    it('returns false and sets exercises error when exercise list is empty', () => {
        store().setTitle('Силовая • 3 круга')
        const ok = store().validate()
        expect(ok).toBe(false)
        expect(store().validationErrors.exercises).toBeTruthy()
    })

    it('returns true when title and at least one exercise are present', () => {
        store().setTitle('Силовая • 3 круга')
        store().addExercise(makeExercise('ex-1'))
        const ok = store().validate()
        expect(ok).toBe(true)
        expect(store().validationErrors).toEqual({})
    })

    it('clears existing errors before re-validation', () => {
        // First call fills errors
        store().validate()
        expect(store().validationErrors.title).toBeTruthy()

        // Fix state, re-validate
        store().setTitle('Силовая')
        store().addExercise(makeExercise('ex-1'))
        const ok = store().validate()
        expect(ok).toBe(true)
        expect(store().validationErrors.title).toBeUndefined()
        expect(store().validationErrors.exercises).toBeUndefined()
    })
})

// ── setTitle ─────────────────────────────────────────────────────────────────

describe('setTitle()', () => {
    it('marks isDirty and clears title validation error', () => {
        // Pre-set an error
        store().setValidationError('title', 'Введите название')
        expect(store().validationErrors.title).toBeTruthy()

        store().setTitle('Новое название')
        expect(store().title).toBe('Новое название')
        expect(store().isDirty).toBe(true)
        expect(store().validationErrors.title).toBeUndefined()
    })
})

// ── addExercise ───────────────────────────────────────────────────────────────

describe('addExercise()', () => {
    it('appends to exercises array and clears exercises error', () => {
        store().setValidationError('exercises', 'Добавьте упражнения')
        store().addExercise(makeExercise('ex-1'))
        expect(store().exercises).toHaveLength(1)
        expect(store().exercises[0].id).toBe('ex-1')
        expect(store().validationErrors.exercises).toBeUndefined()
        expect(store().isDirty).toBe(true)
    })

    it('accumulates multiple exercises in order', () => {
        store().addExercise(makeExercise('a'))
        store().addExercise(makeExercise('b'))
        store().addExercise(makeExercise('c'))
        expect(store().exercises.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    })
})

// ── removeExercise ────────────────────────────────────────────────────────────

describe('removeExercise()', () => {
    it('removes by id and marks isDirty', () => {
        store().addExercise(makeExercise('ex-1'))
        store().addExercise(makeExercise('ex-2'))
        store().removeExercise('ex-1')
        expect(store().exercises).toHaveLength(1)
        expect(store().exercises[0].id).toBe('ex-2')
        expect(store().isDirty).toBe(true)
    })
})

// ── updateExercise ────────────────────────────────────────────────────────────

describe('updateExercise()', () => {
    it('merges partial updates into the correct item', () => {
        store().addExercise(makeExercise('ex-1'))
        store().updateExercise('ex-1', { name: 'Pull-up' })
        expect(store().exercises[0].name).toBe('Pull-up')
        // Other fields preserved
        expect(store().exercises[0].exerciseId).toBe(1)
    })

    it('does not affect other items', () => {
        store().addExercise(makeExercise('ex-1', 'Squat'))
        store().addExercise(makeExercise('ex-2', 'Deadlift'))
        store().updateExercise('ex-1', { name: 'Front Squat' })
        expect(store().exercises[1].name).toBe('Deadlift')
    })
})

// ── reorderExercises ──────────────────────────────────────────────────────────

describe('reorderExercises()', () => {
    it('moves item from fromIndex to toIndex', () => {
        store().addExercise(makeExercise('a'))
        store().addExercise(makeExercise('b'))
        store().addExercise(makeExercise('c'))

        store().reorderExercises(0, 2) // move 'a' to end
        expect(store().exercises.map((e) => e.id)).toEqual(['b', 'c', 'a'])
    })

    it('handles same-index noop gracefully', () => {
        store().addExercise(makeExercise('a'))
        store().addExercise(makeExercise('b'))
        store().reorderExercises(0, 0)
        expect(store().exercises.map((e) => e.id)).toEqual(['a', 'b'])
    })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset()', () => {
    it('restores initial state', () => {
        store().setTitle('Test')
        store().addExercise(makeExercise('ex-1'))
        store().setValidationError('exercises', 'err')
        store().reset()
        expect(store().title).toBe('')
        expect(store().exercises).toHaveLength(0)
        expect(store().isDirty).toBe(false)
        expect(store().validationErrors).toEqual({})
    })
})

// ── setMode ───────────────────────────────────────────────────────────────────

describe('setMode()', () => {
    it('sets mode and marks dirty if different', () => {
        store().setMode('strength')
        store().markClean()
        store().setMode('cardio')
        expect(store().mode).toBe('cardio')
        expect(store().isDirty).toBe(true)
    })
})
