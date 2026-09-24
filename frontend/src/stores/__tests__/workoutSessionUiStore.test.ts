import { useWorkoutSessionUiStore } from '../workoutSessionUiStore'

const store = () => useWorkoutSessionUiStore.getState()

function startRest(seconds: number) {
    store().startSessionRestTimer({
        forExerciseId: '1-0',
        exerciseIndex: 0,
        exerciseName: 'Жим лёжа',
        nextSetOrdinal: 2,
        totalSets: 3,
        total: seconds,
    })
}

describe('workoutSessionUiStore rest timer (SPEC-005 §17)', () => {
    beforeEach(() => {
        store().skipSessionRestTimer()
        jest.restoreAllMocks()
    })

    it('starts a full countdown', () => {
        startRest(120)

        expect(store().sessionRestTimer).toMatchObject({
            active: true,
            remaining: 120,
            total: 120,
        })
    })

    it('adjusts by ±30 seconds and never goes below zero', () => {
        startRest(120)

        store().adjustSessionRestTimer(30)
        expect(store().sessionRestTimer?.remaining).toBe(150)
        expect(store().sessionRestTimer?.total).toBe(150)
        expect(store().sessionRestTimer?.active).toBe(true)

        store().adjustSessionRestTimer(-30)
        expect(store().sessionRestTimer?.remaining).toBe(120)

        store().adjustSessionRestTimer(-300)
        expect(store().sessionRestTimer?.remaining).toBe(0)
        expect(store().sessionRestTimer?.active).toBe(false)
    })

    it('counts down from timestamps so background throttling stays correct', () => {
        jest.spyOn(Date, 'now').mockReturnValue(0)
        startRest(120)

        // 10 wall-clock seconds passed while the interval was throttled.
        jest.spyOn(Date, 'now').mockReturnValue(10_000)
        store().tickSessionRestTimer()

        expect(store().sessionRestTimer?.remaining).toBe(110)
        expect(store().sessionRestTimer?.active).toBe(true)
    })

    it('stops the countdown at zero', () => {
        jest.spyOn(Date, 'now').mockReturnValue(0)
        startRest(5)

        jest.spyOn(Date, 'now').mockReturnValue(60_000)
        store().tickSessionRestTimer()

        expect(store().sessionRestTimer?.remaining).toBe(0)
        expect(store().sessionRestTimer?.active).toBe(false)
    })

    it('restarts from the total and clears on skip', () => {
        jest.spyOn(Date, 'now').mockReturnValue(0)
        startRest(60)
        jest.spyOn(Date, 'now').mockReturnValue(30_000)
        store().tickSessionRestTimer()
        expect(store().sessionRestTimer?.remaining).toBe(30)

        store().restartSessionRestTimer()
        expect(store().sessionRestTimer?.remaining).toBe(60)
        expect(store().sessionRestTimer?.active).toBe(true)

        store().skipSessionRestTimer()
        expect(store().sessionRestTimer).toBeNull()
    })
})
