import { create } from 'zustand'

/**
 * UI-only state for the simplified active workout session (modal, optional flags).
 * Серверные данные и позиция подхода остаются в TanStack Query + activeWorkoutStore.
 */
interface WorkoutSessionUiState {
    /** Индекс открытого в модалке упражнения или null */
    modalExerciseIndex: number | null
    openExerciseModal: (exerciseIndex: number) => void
    closeExerciseModal: () => void
}

export const useWorkoutSessionUiStore = create<WorkoutSessionUiState>((set) => ({
    modalExerciseIndex: null,
    openExerciseModal: (exerciseIndex) => set({ modalExerciseIndex: exerciseIndex }),
    closeExerciseModal: () => set({ modalExerciseIndex: null }),
}))
