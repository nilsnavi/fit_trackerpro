import { create } from 'zustand'
import type { CompletedExercise } from '@features/workouts/types/workouts'

export type ActiveWorkoutSyncState = 'idle' | 'syncing' | 'synced' | 'error'

export interface ActiveWorkoutRestTimerState {
    isRunning: boolean
    isPaused: boolean
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
    tickRestTimer: () => void
    pauseRestTimer: () => void
    resumeRestTimer: () => void
    restartRestTimer: () => void
    skipRestTimer: () => void
    stopRestTimer: () => void
    setRestDefaultSeconds: (seconds: number) => void
    setExercises: (exercises: CompletedExercise[]) => void
    setSyncState: (syncState: ActiveWorkoutSyncState) => void
    reset: () => void
}

const initialRestTimerState: ActiveWorkoutRestTimerState = {
    isRunning: false,
    isPaused: false,
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
                isRunning: nextDuration > 0,
                isPaused: false,
                durationSeconds: nextDuration,
                remainingSeconds: nextDuration,
            },
        })
    },

    tickRestTimer: () =>
        set((state) => {
            if (!state.restTimer.isRunning) return state
            const remainingSeconds = Math.max(0, state.restTimer.remainingSeconds - 1)
            return {
                restTimer: {
                    ...state.restTimer,
                    remainingSeconds,
                    isPaused: false,
                    isRunning: remainingSeconds > 0,
                },
            }
        }),

    pauseRestTimer: () =>
        set((state) => {
            if (!state.restTimer.isRunning) return state
            return {
                restTimer: {
                    ...state.restTimer,
                    isRunning: false,
                    isPaused: true,
                },
            }
        }),

    resumeRestTimer: () =>
        set((state) => {
            if (!state.restTimer.isPaused || state.restTimer.remainingSeconds <= 0) return state
            return {
                restTimer: {
                    ...state.restTimer,
                    isRunning: true,
                    isPaused: false,
                },
            }
        }),

    restartRestTimer: () =>
        set((state) => {
            if (state.restTimer.durationSeconds <= 0) return state
            return {
                restTimer: {
                    ...state.restTimer,
                    isRunning: true,
                    isPaused: false,
                    remainingSeconds: state.restTimer.durationSeconds,
                },
            }
        }),

    skipRestTimer: () => set({ restTimer: initialRestTimerState }),

    stopRestTimer: () => set({ restTimer: initialRestTimerState }),

    setRestDefaultSeconds: (seconds) => set({ restDefaultSeconds: Math.max(15, Math.floor(seconds)) }),

    setExercises: (exercises) => set({ exercises }),

    setSyncState: (syncState) => set({ syncState }),

    reset: () => set(initialState),
}))
