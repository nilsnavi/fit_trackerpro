import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { CompletedExercise } from '@features/workouts/types/workouts'

export type ActiveWorkoutSyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline-queued'
| 'saved-locally' | 'conflict'

/**
 * Legacy rest-timer slice of the session store: written by `startRestTimer` and read
 * by `useActiveWorkoutRestFlow`. The live countdown UI lives in
 * `workoutSessionUiStore.sessionRestTimer` (SPEC-005 §17).
 */
export interface ActiveWorkoutRestTimerState {
    remainingSeconds: number
    durationSeconds: number
}

interface ActiveWorkoutState {
    sessionId: number | null
    currentExerciseIndex: number
    currentSetIndex: number
    startedAt: number | null
    elapsedSeconds: number
    restTimer: ActiveWorkoutRestTimerState
    restDefaultSeconds: number
    lastCompletedSet: { exerciseIndex: number; setNumber: number } | null
    exercises: CompletedExercise[]
    syncState: ActiveWorkoutSyncState

    initializeSession: (payload: {
        sessionId: number
        startedAt: number
        exercises: CompletedExercise[]
    }) => void
    setCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    setElapsedSeconds: (elapsedSeconds: number) => void
    startRestTimer: (durationSeconds: number) => void
    skipRestTimer: () => void
    setRestDefaultSeconds: (seconds: number) => void
    setLastCompletedSet: (value: { exerciseIndex: number; setNumber: number } | null) => void
    setExercises: (exercises: CompletedExercise[]) => void
    setSyncState: (syncState: ActiveWorkoutSyncState) => void
    reset: () => void
}

const initialRestTimerState: ActiveWorkoutRestTimerState = {
    remainingSeconds: 0,
    durationSeconds: 0,
}

const initialState = {
    sessionId: null,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    startedAt: null,
    elapsedSeconds: 0,
    restTimer: initialRestTimerState,
    restDefaultSeconds: 90,
    lastCompletedSet: null as { exerciseIndex: number; setNumber: number } | null,
    exercises: [] as CompletedExercise[],
    syncState: 'idle' as ActiveWorkoutSyncState,
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set) => ({
    ...initialState,

    initializeSession: ({ sessionId, startedAt, exercises }) =>
        set((state) => {
            if (state.sessionId === sessionId) {
                return { exercises }
            }
            return {
                sessionId,
                startedAt,
                elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
                currentExerciseIndex: 0,
                currentSetIndex: 0,
                restTimer: initialRestTimerState,
                restDefaultSeconds: 90,
                lastCompletedSet: null,
                exercises,
                syncState: 'idle',
            }
        }),

    setCurrentPosition: (currentExerciseIndex, currentSetIndex) =>
        set({ currentExerciseIndex, currentSetIndex }),

    setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds: Math.max(0, elapsedSeconds) }),

    startRestTimer: (durationSeconds) => {
        const nextDuration = Math.max(0, Math.floor(durationSeconds))
        set({
            restTimer: {
                durationSeconds: nextDuration,
                remainingSeconds: nextDuration,
            },
        })
    },

    skipRestTimer: () => set({ restTimer: initialRestTimerState }),

    setRestDefaultSeconds: (seconds) => set({ restDefaultSeconds: Math.max(15, Math.floor(seconds)) }),

    setLastCompletedSet: (value) => set({ lastCompletedSet: value }),

    setExercises: (exercises) => set({ exercises }),

    setSyncState: (syncState) => set({ syncState }),

    reset: () => set(initialState),
}))

// ── Composite selector hooks ──────────────────────────────────────────────────

/**
 * Selects mutable session state fields in a single subscription.
 * Uses shallow equality — re-renders only when any field reference changes.
 */
export function useActiveWorkoutStateSlice() {
    return useActiveWorkoutStore(
        useShallow((s) => ({
            sessionId: s.sessionId,
            exercises: s.exercises,
            currentExerciseIndex: s.currentExerciseIndex,
            currentSetIndex: s.currentSetIndex,
            startedAt: s.startedAt,
            elapsedSeconds: s.elapsedSeconds,
            syncState: s.syncState,
            restTimer: s.restTimer,
            restDefaultSeconds: s.restDefaultSeconds,
            lastCompletedSet: s.lastCompletedSet,
        })),
    )
}

/**
 * Returns all store actions in a single shallow-stable subscription.
 * Since Zustand actions are stable function references, this never triggers
 * a re-render — it is equivalent to calling `getState()` at render time but
 * participates in the React subscription model correctly.
 */
export function useActiveWorkoutActions() {
    return useActiveWorkoutStore(
        useShallow((s) => ({
            initializeSession: s.initializeSession,
            setCurrentPosition: s.setCurrentPosition,
            setElapsedSeconds: s.setElapsedSeconds,
            setSyncState: s.setSyncState,
            setExercises: s.setExercises,
            setRestDefaultSeconds: s.setRestDefaultSeconds,
            startRestTimer: s.startRestTimer,
            skipRestTimer: s.skipRestTimer,
            reset: s.reset,
            setLastCompletedSet: s.setLastCompletedSet,
        })),
    )
}
