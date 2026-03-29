import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkoutSessionDraftState {
    workoutId: number | null
    title: string | null
    updatedAt: number
    setDraft: (workoutId: number, title: string) => void
    hydrateFromRemote: (draft: { workoutId: number; title: string; updatedAt: number }) => void
    clearDraft: () => void
}

export const useWorkoutSessionDraftStore = create<WorkoutSessionDraftState>()(
    persist(
        (set) => ({
            workoutId: null,
            title: null,
            updatedAt: 0,
            setDraft: (workoutId, title) =>
                set({ workoutId, title, updatedAt: Date.now() }),
            hydrateFromRemote: (draft) =>
                set({
                    workoutId: draft.workoutId,
                    title: draft.title,
                    updatedAt: draft.updatedAt,
                }),
            clearDraft: () => set({ workoutId: null, title: null, updatedAt: 0 }),
        }),
        { name: 'workout-session-draft' },
    ),
)
