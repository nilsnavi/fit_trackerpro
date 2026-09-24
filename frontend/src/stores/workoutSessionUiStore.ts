import { create } from 'zustand'

/**
 * Полноэкранный таймер отдыха между подходами (экран сессии).
 * `forExerciseId` — стабильный ключ «упражнение в сессии», см. deriveExerciseSessionState.
 * SPEC-005 §17: `startedAtMs` allows background-correct countdown (timestamp based).
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
    /** Wall-clock ms when the current remaining value was computed. */
    startedAtMs?: number
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
    /** SPEC-005 §17: [-30 сек] / [+30 сек] quick controls. */
    adjustSessionRestTimer: (deltaSeconds: number) => void
    restartSessionRestTimer: () => void
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
                startedAtMs: Date.now(),
            },
        }),
    tickSessionRestTimer: () =>
        set((s) => {
            const t = s.sessionRestTimer
            if (!t || t.remaining <= 0) return s
            // SPEC-005 §17/AC-005-007: compute remaining from timestamps so the
            // countdown stays correct after background/interval throttling.
            const now = Date.now()
            const anchor = t.startedAtMs ?? now
            const elapsedSinceAnchor = Math.floor((now - anchor) / 1000)
            const remaining = Math.max(0, t.remaining - Math.max(1, elapsedSinceAnchor))
            return {
                sessionRestTimer: {
                    ...t,
                    remaining,
                    startedAtMs: now,
                    active: remaining > 0,
                },
            }
        }),
    /** SPEC-005 §17: [-30 сек] quick control. */
    adjustSessionRestTimer: (deltaSeconds) =>
        set((s) => {
            const t = s.sessionRestTimer
            if (!t) return s
            const remaining = Math.max(0, t.remaining + deltaSeconds)
            return {
                sessionRestTimer: {
                    ...t,
                    remaining,
                    total: Math.max(t.total, remaining),
                    startedAtMs: Date.now(),
                    active: remaining > 0,
                },
            }
        }),
    restartSessionRestTimer: () =>
        set((s) => {
            const t = s.sessionRestTimer
            if (!t) return s
            return {
                sessionRestTimer: {
                    ...t,
                    active: t.total > 0,
                    remaining: t.total,
                    startedAtMs: Date.now(),
                },
            }
        }),
    skipSessionRestTimer: () => set({ sessionRestTimer: null }),
}))
