import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'

import { useActiveWorkoutSync } from '../useActiveWorkoutSync'
import { queryKeys } from '@shared/api/queryKeys'
import type {
    CompletedExercise,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
import { toast } from '@shared/stores/toastStore'

jest.mock('@shared/stores/toastStore', () => ({
    toast: {
        info: jest.fn(),
        success: jest.fn(),
        retry: jest.fn(),
    },
}))

function makeExercise(completed = false): CompletedExercise {
    return {
        exercise_id: 1,
        name: 'Bench Press',
        sets_completed: [
            {
                set_number: 1,
                reps: 8,
                weight: 60,
                completed,
            },
        ],
    }
}

function makeWorkout(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
    return {
        id: 77,
        date: '2026-04-05',
        duration: undefined,
        exercises: [makeExercise(false)],
        comments: 'draft',
        tags: ['push'],
        created_at: '2026-04-05T10:00:00.000Z',
        ...overrides,
    }
}

function makePayload(workout: WorkoutHistoryItem): WorkoutSessionUpdateRequest {
    return {
        exercises: workout.exercises,
        comments: workout.comments,
        tags: workout.tags,
        glucose_before: workout.glucose_before,
        glucose_after: workout.glucose_after,
    }
}

function setNavigatorOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value,
    })
}

describe('useActiveWorkoutSync', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        setNavigatorOnline(true)
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    it('debounces changed workout snapshots and syncs the latest payload', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const changedWorkout = makeWorkout({
            comments: 'updated',
            exercises: [makeExercise(true)],
        })
        const mutate = jest.fn((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
            options.onSuccess(changedWorkout)
        })

        const initializeActiveSession = jest.fn()
        const setActiveExercises = jest.fn()
        const setCurrentPosition = jest.fn()
        const setActiveElapsedSeconds = jest.fn()
        const setActiveSyncState = jest.fn()
        const clearWorkoutSessionDraft = jest.fn()
        const buildSyncPayload = jest.fn((workout: WorkoutHistoryItem) => makePayload(workout))

        const { result, rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
                    startedAt: null,
                    queryClient,
                    initializeActiveSession,
                    setActiveExercises,
                    setCurrentPosition,
                    setActiveElapsedSeconds,
                    setActiveSyncState,
                    clearWorkoutSessionDraft,
                    updateSessionMutation: { mutate },
                    buildSyncPayload,
                }),
            { initialProps: initialWorkout },
        )

        await waitFor(() => {
            expect(result.current.lastSyncedPayload).toEqual(makePayload(initialWorkout))
        })

        rerender(changedWorkout)

        expect(result.current.hasPendingChanges).toBe(true)
        expect(mutate).not.toHaveBeenCalled()

        act(() => {
            jest.advanceTimersByTime(1_999)
        })
        expect(mutate).not.toHaveBeenCalled()

        act(() => {
            jest.advanceTimersByTime(1)
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(mutate).toHaveBeenCalledWith(
            { workoutId: 77, payload: makePayload(changedWorkout) },
            expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
        )
        expect(result.current.syncState).toBe('synced')
        expect(result.current.lastSyncedPayload).toEqual(makePayload(changedWorkout))
        expect(result.current.hasPendingChanges).toBe(false)
        expect(queryClient.getQueryData(queryKeys.workouts.historyItem(77))).toEqual(changedWorkout)
        expect(setActiveSyncState).toHaveBeenLastCalledWith('synced')
    })

    it('marks changes as offline queued and flushes them after reconnect', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const changedWorkout = makeWorkout({ comments: 'offline update' })
        const mutate = jest.fn((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
            options.onSuccess(changedWorkout)
        })

        const { result, rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
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
            { initialProps: initialWorkout },
        )

        setNavigatorOnline(false)
        rerender(changedWorkout)

        act(() => {
            jest.advanceTimersByTime(2_000)
        })

        await waitFor(() => {
            expect(result.current.syncState).toBe('offline-queued')
        })

        expect(result.current.isOffline).toBe(true)
        expect(mutate).not.toHaveBeenCalled()
        expect(toast.info).toHaveBeenCalledWith('Офлайн: изменения поставлены в очередь синхронизации')

        setNavigatorOnline(true)
        act(() => {
            window.dispatchEvent(new Event('online'))
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(result.current.syncState).toBe('synced')
        expect(toast.success).toHaveBeenCalledWith('Синхронизация восстановлена, изменения сохранены')
    })

    it('retries failed sync automatically after the backoff delay', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const changedWorkout = makeWorkout({ comments: 'retry update' })
        const mutate = jest
            .fn()
            .mockImplementationOnce((_, options: { onError: () => void }) => {
                options.onError()
            })
            .mockImplementationOnce((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
                options.onSuccess(changedWorkout)
            })

        const { result, rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
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
            { initialProps: initialWorkout },
        )

        rerender(changedWorkout)

        act(() => {
            jest.advanceTimersByTime(2_000)
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(result.current.syncState).toBe('error')
        expect(toast.retry).toHaveBeenCalledTimes(1)

        act(() => {
            jest.advanceTimersByTime(2_000)
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(2)
        })

        expect(result.current.syncState).toBe('synced')
        expect(result.current.lastSyncedPayload).toEqual(makePayload(changedWorkout))
    })

    it('flushNow bypasses debounce and sends sync immediately', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const changedWorkout = makeWorkout({ comments: 'flush now update' })
        const mutate = jest.fn((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
            options.onSuccess(changedWorkout)
        })

        const { result, rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
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
            { initialProps: initialWorkout },
        )

        rerender(changedWorkout)

        act(() => {
            result.current.flushNow()
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(result.current.lastSyncedPayload).toEqual(makePayload(changedWorkout))
        expect(result.current.hasPendingChanges).toBe(false)
    })

    it('keeps only the latest payload when changes happen quickly (fast clicks)', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const changedA = makeWorkout({
            comments: 'tap-1',
            exercises: [
                {
                    exercise_id: 1,
                    name: 'Bench Press',
                    sets_completed: [
                        { set_number: 1, reps: 8, weight: 60, completed: true },
                    ],
                },
            ],
        })
        const changedB = makeWorkout({
            comments: 'tap-2',
            exercises: [
                {
                    exercise_id: 1,
                    name: 'Bench Press',
                    sets_completed: [
                        { set_number: 1, reps: 9, weight: 60, completed: true },
                    ],
                },
            ],
        })

        const mutate = jest.fn((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
            options.onSuccess(changedB)
        })

        const { rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
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
            { initialProps: initialWorkout },
        )

        rerender(changedA)
        rerender(changedB)

        act(() => {
            jest.advanceTimersByTime(2_000)
        })

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1)
        })

        expect(mutate).toHaveBeenCalledWith(
            { workoutId: 77, payload: makePayload(changedB) },
            expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
        )
    })

    it('flushes pending changes on visibilitychange, blur and beforeunload', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const initialWorkout = makeWorkout()
        const mutate = jest.fn((_, options: { onSuccess: (data: WorkoutHistoryItem) => void }) => {
            options.onSuccess(changedWorkoutRef.current)
        })
        const changedWorkoutRef = {
            current: makeWorkout({ comments: 'visibility update' }),
        }

        const { rerender } = renderHook(
            (workout: WorkoutHistoryItem) =>
                useActiveWorkoutSync({
                    workoutId: workout.id,
                    workout,
                    draftWorkoutId: workout.id,
                    isActiveDraft: true,
                    activeExercises: workout.exercises,
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
            { initialProps: initialWorkout },
        )

        const flushViaEvent = async (event: 'visibilitychange' | 'blur' | 'beforeunload', comments: string) => {
            changedWorkoutRef.current = makeWorkout({ comments })
            rerender(changedWorkoutRef.current)

            if (event === 'visibilitychange') {
                Object.defineProperty(document, 'visibilityState', {
                    configurable: true,
                    value: 'hidden',
                })
                act(() => {
                    document.dispatchEvent(new Event('visibilitychange'))
                })
            } else {
                act(() => {
                    window.dispatchEvent(new Event(event))
                })
            }

            await waitFor(() => {
                expect(mutate).toHaveBeenCalled()
            })
        }

        await flushViaEvent('visibilitychange', 'visibility update')
        await flushViaEvent('blur', 'blur update')
        await flushViaEvent('beforeunload', 'unload update')

        expect(mutate).toHaveBeenCalledTimes(3)
        expect(mutate).toHaveBeenNthCalledWith(
            1,
            { workoutId: 77, payload: makePayload(makeWorkout({ comments: 'visibility update' })) },
            expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
        )
        expect(mutate).toHaveBeenNthCalledWith(
            2,
            { workoutId: 77, payload: makePayload(makeWorkout({ comments: 'blur update' })) },
            expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
        )
        expect(mutate).toHaveBeenNthCalledWith(
            3,
            { workoutId: 77, payload: makePayload(makeWorkout({ comments: 'unload update' })) },
            expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
        )
    })
})