import { create } from 'zustand'

/**
 * Полноэкранный таймер отдыха между подходами (экран сессии).
 * `forExerciseId` — стабильный ключ «упражнение в сессии», см. deriveExerciseSessionState.
 */
export type SessionRestTimerState = {
    active: boolean
    forExerciseId: string
    exerciseIndex: number
    exerciseName: string
    nextSetOrdinal: number
    totalSets: number
    remaining: number
    total: number
}

/**
 * UI-only state for the simplified active workout session (modal, optional flags).
 * Серверные данные и позиция подхода остаются в TanStack Query + activeWorkoutStore.
 */
interface WorkoutSessionUiState {
    /** Индекс открытого в модалке упражнения или null */
    modalExerciseIndex: number | null
    openExerciseModal: (exerciseIndex: number) => void
    closeExerciseModal: () => void

    sessionRestTimer: SessionRestTimerState | null
    startSessionRestTimer: (payload: Omit<SessionRestTimerState, 'active' | 'remaining'>) => void
    tickSessionRestTimer: () => void
    skipSessionRestTimer: () => void
}

export const useWorkoutSessionUiStore = create<WorkoutSessionUiState>((set) => ({
    modalExerciseIndex: null,
    openExerciseModal: (exerciseIndex) => set({ modalExerciseIndex: exerciseIndex }),
    closeExerciseModal: () => set({ modalExerciseIndex: null }),

    sessionRestTimer: null,
    startSessionRestTimer: (payload) =>
        set({
            sessionRestTimer: {
                ...payload,
                active: true,
                remaining: payload.total,
            },
        }),
    tickSessionRestTimer: () =>
        set((s) => {
            const t = s.sessionRestTimer
            if (!t || t.remaining <= 0) return s
            const remaining = t.remaining - 1
            return {
                sessionRestTimer: {
                    ...t,
                    remaining,
                    active: remaining > 0,
                },
            }
        }),
    skipSessionRestTimer: () => set({ sessionRestTimer: null }),
}))
