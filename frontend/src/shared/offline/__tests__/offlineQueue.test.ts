import {
    flushQueue,
    getQueueSize,
    OFFLINE_WORKOUT_QUEUE_KEY,
    saveToQueue,
    type WorkoutSetPayload,
} from '../offlineQueue'
import type { WorkoutHistoryItem, WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

const sampleBody: WorkoutSessionUpdateRequest = {
    exercises: [],
    comments: 'x',
    tags: [],
}

function makePayload(overrides: Partial<WorkoutSetPayload> = {}): WorkoutSetPayload {
    return {
        workoutId: 42,
        body: sampleBody,
        ...overrides,
    }
}

describe('offlineQueue', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('saveToQueue appends and getQueueSize counts all or filtered by workoutId', () => {
        expect(getQueueSize()).toBe(0)
        saveToQueue(makePayload({ workoutId: 1 }))
        expect(getQueueSize()).toBe(1)
        expect(getQueueSize(1)).toBe(1)
        expect(getQueueSize(2)).toBe(0)
        saveToQueue(makePayload({ workoutId: 2 }))
        expect(getQueueSize()).toBe(2)
        expect(getQueueSize(1)).toBe(1)
        expect(getQueueSize(2)).toBe(1)
    })

    it('flushQueue sends FIFO and clears matching items', async () => {
        const responses: WorkoutHistoryItem[] = [
            { id: 1, date: '2026-01-01', exercises: [], comments: 'a', tags: [], created_at: '' },
            { id: 1, date: '2026-01-01', exercises: [], comments: 'b', tags: [], created_at: '' },
        ]
        const updateWorkoutSession = jest
            .fn()
            .mockResolvedValueOnce(responses[0])
            .mockResolvedValueOnce(responses[1])

        saveToQueue(makePayload({ workoutId: 7, body: { ...sampleBody, comments: 'a' } }))
        saveToQueue(makePayload({ workoutId: 7, body: { ...sampleBody, comments: 'b' } }))

        const result = await flushQueue({ updateWorkoutSession }, { workoutId: 7 })

        expect(updateWorkoutSession).toHaveBeenCalledTimes(2)
        expect(updateWorkoutSession.mock.calls[0][0]).toBe(7)
        expect(updateWorkoutSession.mock.calls[1][0]).toBe(7)
        expect(result.flushed).toBe(2)
        expect(result.last).toEqual(responses[1])
        expect(localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY)).toBeNull()
    })

    it('flushQueue with workoutId leaves other workouts in storage', async () => {
        const updateWorkoutSession = jest.fn().mockResolvedValue({} as WorkoutHistoryItem)
        saveToQueue(makePayload({ workoutId: 1 }))
        saveToQueue(makePayload({ workoutId: 2 }))

        await flushQueue({ updateWorkoutSession }, { workoutId: 1 })

        expect(updateWorkoutSession).toHaveBeenCalledTimes(1)
        const raw = localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY)
        expect(raw).toBeTruthy()
        const remaining = JSON.parse(raw ?? '[]') as WorkoutSetPayload[]
        expect(remaining).toHaveLength(1)
        expect(remaining[0].workoutId).toBe(2)
    })

    it('flushQueue preserves unsent items on API error', async () => {
        const updateWorkoutSession = jest.fn().mockRejectedValueOnce(new Error('network'))
        saveToQueue(makePayload({ workoutId: 5 }))
        saveToQueue(makePayload({ workoutId: 5 }))

        await expect(flushQueue({ updateWorkoutSession }, { workoutId: 5 })).rejects.toThrow('network')

        expect(updateWorkoutSession).toHaveBeenCalledTimes(1)
        expect(getQueueSize(5)).toBe(2)
    })
})
