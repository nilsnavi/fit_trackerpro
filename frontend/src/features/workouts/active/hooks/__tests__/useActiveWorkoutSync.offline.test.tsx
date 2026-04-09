/**
 * Offline-specific scenarios for useActiveWorkoutSync.
 *
 * Scenarios covered:
 *  1. offline open    — first executeSync queues to offline-queued, mutate not called
 *  2. add sets offline — multiple debounced updates while offline: mutate never fires
 *  3. reconnect → sync — online event flushes with latest payload, mutate called once
 *  4. no duplicate on reconnect — pending debounce is cancelled before reconnect flush
 *  5. flushNow before navigate — flushNow() skips debounce, fires mutate immediately
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'

import { useActiveWorkoutSync } from '../useActiveWorkoutSync'
import type {
    CompletedExercise,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
jest.mock('@shared/stores/toastStore', () => ({
    toast: {
        info: jest.fn(),
        success: jest.fn(),
        retry: jest.fn(),
    },
}))

// ── helpers ──────────────────────────────────────────────────────────────────

function makeExercise(completed = false): CompletedExercise {
    return {
        exercise_id: 1,
        name: 'Squat',
        sets_completed: [{ set_number: 1, reps: 5, weight: 100, completed }],
    }
}

function makeWorkout(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
    return {
        id: 99,
        date: '2026-04-09',
        duration: undefined,
        exercises: [makeExercise(false)],
        comments: 'initial',
        tags: [],
        created_at: '2026-04-09T08:00:00.000Z',
        ...overrides,
    }
}

function makePayload(workout: WorkoutHistoryItem): WorkoutSessionUpdateRequest {
    return {
        exercises: workout.exercises,
        comments: workout.comments,
        tags: workout.tags ?? [],
        glucose_before: workout.glucose_before,
        glucose_after: workout.glucose_after,
    }
}

function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
}

function makeHook(
    workout: WorkoutHistoryItem,
    mutate: jest.Mock,
    queryClient: QueryClient,
) {
    return renderHook(
        (w: WorkoutHistoryItem) =>
            useActiveWorkoutSync({
                workoutId: w.id,
                workout: w,
                draftWorkoutId: w.id,
                isActiveDraft: true,
                activeExercises: w.exercises,
                startedAt: null,
                queryClient,
                initializeActiveSession: jest.fn(),
                setActiveExercises: jest.fn(),
                setCurrentPosition: jest.fn(),
                setActiveElapsedSeconds: jest.fn(),
                setActiveSyncState: jest.fn(),
                clearWorkoutSessionDraft: jest.fn(),
                updateSessionMutation: { mutate },
                buildSyncPayload: makePayload,
            }),
        { initialProps: workout },
    )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useActiveWorkoutSync — offline scenarios', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        setOnline(true)
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
        setOnline(true)
    })

    // ── Scenario 1: offline open ──────────────────────────────────────────────
    it('1. offline open: queues to offline-queued without calling mutate', async () => {
        setOnline(false)
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const workout = makeWorkout()
        const mutate = jest.fn()

        const { result, rerender } = makeHook(workout, mutate, qc)

        // Wait for baseline
        await waitFor(() => {
            expect(result.current.lastSyncedPayload).not.toBeNull()
        })

        // Trigger a change while offline
        const changed = makeWorkout({ comments: 'offline-change' })
        rerender(changed)

        act(() => { jest.advanceTimersByTime(2_000) })

        await waitFor(() => {
            expect(result.current.syncState).toBe('offline-queued')
        })

        expect(mutate).not.toHaveBeenCalled()
        expect(result.current.isOffline).toBe(true)
    })

    // ── Scenario 2: add sets offline ─────────────────────────────────────────
    it('2. add sets offline: multiple rapid updates never trigger mutate', async () => {
        setOnline(false)
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const workout = makeWorkout()
        const mutate = jest.fn()

        const { result, rerender } = makeHook(workout, mutate, qc)

        await waitFor(() => {
            expect(result.current.lastSyncedPayload).not.toBeNull()
        })

        // Simulate three rapid set additions while offline
        rerender(makeWorkout({ comments: 'set 1' }))
        act(() => { jest.advanceTimersByTime(500) })

        rerender(makeWorkout({ comments: 'set 2' }))
        act(() => { jest.advanceTimersByTime(500) })

        rerender(makeWorkout({ comments: 'set 3', exercises: [makeExercise(true)] }))
        act(() => { jest.advanceTimersByTime(2_000) })

        await waitFor(() => {
            expect(result.current.syncState).toBe('offline-queued')
        })

        // mutate must never have been called
        expect(mutate).not.toHaveBeenCalled()

        // pendingPayload holds the latest snapshot
        expect(result.current.pendingPayload?.comments).toBe('set 3')
    })

    // ── Scenario 3: reconnect → sync ─────────────────────────────────────────
    it('3. reconnect flushes with latest payload, mutate called exactly once', async () => {
        setOnline(false)
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const workout = makeWorkout()
        const latestWorkout = makeWorkout({ comments: 'latest offline edit', exercises: [makeExercise(true)] })
        const mutate = jest.fn((_, opts: { onSuccess: (d: WorkoutHistoryItem) => void }) => {
            opts.onSuccess(latestWorkout)
        })

        const { rerender } = makeHook(workout, mutate, qc)

        await waitFor(() => expect(mutate).not.toHaveBeenCalled())

        // Go offline and queue a change
        rerender(latestWorkout)
        act(() => { jest.advanceTimersByTime(2_000) })

        // Restore connection
        setOnline(true)
        act(() => { window.dispatchEvent(new Event('online')) })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(mutate).toHaveBeenCalledWith(
            { workoutId: 99, payload: makePayload(latestWorkout) },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        )
    })

    // ── Scenario 4: no duplicate on reconnect (Bug 1 regression) ─────────────
    it('4. reconnect cancels pending debounce — mutate fires only once, not twice', async () => {
        setOnline(true)
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const workout = makeWorkout()
        const changedWorkout = makeWorkout({ comments: 'debounce race' })
        const mutate = jest.fn((_, opts: { onSuccess: (d: WorkoutHistoryItem) => void }) => {
            opts.onSuccess(changedWorkout)
        })

        const { result, rerender } = makeHook(workout, mutate, qc)

        await waitFor(() => {
            expect(result.current.lastSyncedPayload).not.toBeNull()
        })

        // Trigger a change to start the debounce timer
        rerender(changedWorkout)
        // Advance timer partially — debounce is still pending
        act(() => { jest.advanceTimersByTime(1_000) })

        // Go offline then immediately reconnect (debounce is still running)
        setOnline(false)
        act(() => { window.dispatchEvent(new Event('offline')) })

        setOnline(true)
        act(() => { window.dispatchEvent(new Event('online')) })

        // Let any remaining timers fire
        act(() => { jest.advanceTimersByTime(2_000) })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        // Must not have been called a second time
        expect(mutate).toHaveBeenCalledTimes(1)
    })

    // ── Scenario 5: flushNow before navigate ──────────────────────────────────
    it('5. flushNow bypasses debounce and fires mutate immediately', async () => {
        setOnline(true)
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const workout = makeWorkout()
        const changedWorkout = makeWorkout({ comments: 'flush before nav' })
        const mutate = jest.fn((_, opts: { onSuccess: (d: WorkoutHistoryItem) => void }) => {
            opts.onSuccess(changedWorkout)
        })

        const { result, rerender } = makeHook(workout, mutate, qc)

        await waitFor(() => {
            expect(result.current.lastSyncedPayload).not.toBeNull()
        })

        rerender(changedWorkout)
        // Do NOT advance timers — debounce is still pending

        // Call flushNow synchronously (simulating user tapping back/navigate)
        let flushed = false
        act(() => {
            void result.current.flushNow().then(() => { flushed = true })
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        await waitFor(() => {
            expect(flushed).toBe(true)
        })
    })
})
