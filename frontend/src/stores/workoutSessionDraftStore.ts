import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { trackBusinessMetric } from '@shared/lib/businessMetrics'

interface WorkoutSessionDraftState {
    workoutId: number | null
    title: string | null
    updatedAt: number
    setDraft: (workoutId: number, title: string) => void
    hydrateFromRemote: (draft: { workoutId: number; title: string; updatedAt: number }) => void
    clearDraft: () => void
    /** Сброс черновика с событием abandoned_workout (явная отмена пользователем). */
    abandonDraft: () => void
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
            abandonDraft: () => {
                const id = useWorkoutSessionDraftStore.getState().workoutId
                if (id != null) {
                    trackBusinessMetric('abandoned_workout', { workout_id: id })
                }
                set({ workoutId: null, title: null, updatedAt: 0 })
            },
        }),
        { name: 'workout-session-draft' },
    ),
)
