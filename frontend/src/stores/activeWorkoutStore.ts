import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { CompletedExercise, ExerciseRestSettings } from '@features/workouts/types/workouts'

export type ActiveWorkoutSyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline-queued'
| 'saved-locally' | 'conflict'

export interface ActiveWorkoutRestTimerState {
    isRunning: boolean
    isPaused: boolean
    remainingSeconds: number
    durationSeconds: number
}

export interface AutoAdvanceSettings {
    enabled: boolean
    countdownSeconds: number
    requireConfirmation: boolean
}

interface ActiveWorkoutState {
    sessionId: number | null
    currentExerciseIndex: number
    currentSetIndex: number
    startedAt: number | null
    elapsedSeconds: number
    restTimer: ActiveWorkoutRestTimerState
    restDefaultSeconds: number
    autoAdvanceSettings: AutoAdvanceSettings
    exerciseRestSettings: Record<number, ExerciseRestSettings> // exercise_id -> settings
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
    setAutoAdvanceSettings: (settings: Partial<AutoAdvanceSettings>) => void
    triggerAutoAdvance: () => void
    cancelAutoAdvance: () => void
    setExerciseRestSettings: (exerciseId: number, settings: Partial<ExerciseRestSettings>) => void
    recordActualRestTime: (exerciseId: number, actualSeconds: number) => void
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
    autoAdvanceSettings: {
        enabled: false,
        countdownSeconds: 3,
        requireConfirmation: true,
    } as AutoAdvanceSettings,
    exerciseRestSettings: {} as Record<number, ExerciseRestSettings>,
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

    setAutoAdvanceSettings: (settings) =>
        set((state) => ({
            autoAdvanceSettings: {
                ...state.autoAdvanceSettings,
                ...settings,
            },
        })),

    triggerAutoAdvance: () => {
        // This action will be called by the timer hook when countdown completes
        // The actual navigation logic is handled in ActiveWorkoutPage
        console.log('Auto-advance triggered')
    },

    cancelAutoAdvance: () => {
        // Cancel any pending auto-advance
        console.log('Auto-advance cancelled')
    },

    setExerciseRestSettings: (exerciseId, settings) =>
        set((state) => ({
            exerciseRestSettings: {
                ...state.exerciseRestSettings,
                [exerciseId]: {
                    exercise_id: exerciseId,
                    custom_rest_seconds: settings.custom_rest_seconds ?? state.restDefaultSeconds,
                    use_global_default: settings.use_global_default ?? true,
                    last_used_seconds: state.exerciseRestSettings[exerciseId]?.last_used_seconds,
                    usage_count: state.exerciseRestSettings[exerciseId]?.usage_count ?? 0,
                    ...settings,
                },
            },
        })),

    recordActualRestTime: (exerciseId, actualSeconds) =>
        set((state) => {
            const existing = state.exerciseRestSettings[exerciseId]
            return {
                exerciseRestSettings: {
                    ...state.exerciseRestSettings,
                    [exerciseId]: {
                        exercise_id: exerciseId,
                        custom_rest_seconds: existing?.custom_rest_seconds ?? state.restDefaultSeconds,
                        use_global_default: existing?.use_global_default ?? true,
                        last_used_seconds: actualSeconds,
                        usage_count: (existing?.usage_count ?? 0) + 1,
                    },
                },
            }
        }),

    setExercises: (exercises) => set({ exercises }),

    setSyncState: (syncState) => set({ syncState }),

    reset: () => set(initialState),
}))

export function useActiveWorkoutActions() {
    return useActiveWorkoutStore(
        useShallow((s) => ({
            initializeSession: s.initializeSession,
            setCurrentPosition: s.setCurrentPosition,
            setElapsedSeconds: s.setElapsedSeconds,
            setSyncState: s.setSyncState,
            setExercises: s.setExercises,
            setRestDefaultSeconds: s.setRestDefaultSeconds,
            setAutoAdvanceSettings: s.setAutoAdvanceSettings,
            triggerAutoAdvance: s.triggerAutoAdvance,
            cancelAutoAdvance: s.cancelAutoAdvance,
            setExerciseRestSettings: s.setExerciseRestSettings,
            recordActualRestTime: s.recordActualRestTime,
            startRestTimer: s.startRestTimer,
            tickRestTimer: s.tickRestTimer,
            pauseRestTimer: s.pauseRestTimer,
            resumeRestTimer: s.resumeRestTimer,
            restartRestTimer: s.restartRestTimer,
            skipRestTimer: s.skipRestTimer,
            stopRestTimer: s.stopRestTimer,
            reset: s.reset,
        })),
    )
}

/**
 * Селектор для получения времени отдыха конкретного упражнения
 */
export function useRestDurationForExercise(exerciseId: number): number {
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const exerciseRestSettings = useActiveWorkoutStore((s) => s.exerciseRestSettings[exerciseId])
    
    if (!exerciseRestSettings || exerciseRestSettings.use_global_default) {
        return restDefaultSeconds
    }
    
    return exerciseRestSettings.custom_rest_seconds
}
