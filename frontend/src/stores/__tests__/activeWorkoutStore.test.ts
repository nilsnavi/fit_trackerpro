import { useActiveWorkoutStore } from '../activeWorkoutStore'
import type { CompletedExercise } from '@features/workouts/types/workouts'

const store = () => useActiveWorkoutStore.getState()

function makeExercise(name = 'Bench Press'): CompletedExercise {
    return {
        exercise_id: 1,
        name,
        sets_completed: [
            {
                set_number: 1,
                reps: 8,
                weight: 60,
                completed: false,
            },
        ],
    }
}

describe('useActiveWorkoutStore', () => {
    beforeEach(() => {
        store().reset()
        jest.restoreAllMocks()
    })

    it('initializes a new session with derived elapsed time', () => {
        jest.spyOn(Date, 'now').mockReturnValue(25_000)

        store().initializeSession({
            sessionId: 42,
            startedAt: 10_000,
            exercises: [makeExercise()],
        })

        expect(store().sessionId).toBe(42)
        expect(store().elapsedSeconds).toBe(15)
        expect(store().currentExerciseIndex).toBe(0)
        expect(store().currentSetIndex).toBe(0)
        expect(store().syncState).toBe('idle')
        expect(store().exercises).toHaveLength(1)
    })

    it('reinitializes same session by replacing exercises only', () => {
        store().initializeSession({
            sessionId: 42,
            startedAt: 10_000,
            exercises: [makeExercise('Bench Press')],
        })
        store().setCurrentPosition(2, 3)
        store().setElapsedSeconds(99)

        store().initializeSession({
            sessionId: 42,
            startedAt: 20_000,
            exercises: [makeExercise('Row')],
        })

        expect(store().sessionId).toBe(42)
        expect(store().currentExerciseIndex).toBe(2)
        expect(store().currentSetIndex).toBe(3)
        expect(store().elapsedSeconds).toBe(99)
        expect(store().exercises[0].name).toBe('Row')
    })

    it('runs the rest timer lifecycle and clamps settings', () => {
        store().startRestTimer(30.8)

        expect(store().restTimer).toEqual({
            isRunning: true,
            isPaused: false,
            remainingSeconds: 30,
            durationSeconds: 30,
        })

        store().tickRestTimer()
        expect(store().restTimer.remainingSeconds).toBe(29)

        store().pauseRestTimer()
        expect(store().restTimer.isPaused).toBe(true)
        expect(store().restTimer.isRunning).toBe(false)

        store().resumeRestTimer()
        expect(store().restTimer.isPaused).toBe(false)
        expect(store().restTimer.isRunning).toBe(true)

        store().restartRestTimer()
        expect(store().restTimer.remainingSeconds).toBe(30)

        store().setRestDefaultSeconds(5.2)
        expect(store().restDefaultSeconds).toBe(15)

        store().skipRestTimer()
        expect(store().restTimer).toEqual({
            isRunning: false,
            isPaused: false,
            remainingSeconds: 0,
            durationSeconds: 0,
        })
    })
})