import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { trackBusinessMetric } from '@shared/lib/businessMetrics'

/** Черновик активной тренировки на клиенте; серверная история — `queryKeys.workouts.*` и мутации в `useWorkoutMutations`. */
interface WorkoutSessionDraftState {
    workoutId: number | null
    templateId: number | null
    title: string | null
    updatedAt: number
    setDraft: (workoutId: number, title: string, templateId?: number | null) => void
    hydrateFromRemote: (draft: { workoutId: number; title: string; updatedAt: number; templateId?: number | null }) => void
    clearDraft: () => void
    /** Сброс черновика с событием abandoned_workout (явная отмена пользователем). */
    abandonDraft: () => void
}

export const useWorkoutSessionDraftStore = create<WorkoutSessionDraftState>()(
    persist(
        (set) => ({
            workoutId: null,
            templateId: null,
            title: null,
            updatedAt: 0,
            setDraft: (workoutId, title, templateId = null) =>
                set({ workoutId, title, templateId, updatedAt: Date.now() }),
            hydrateFromRemote: (draft) =>
                set({
                    workoutId: draft.workoutId,
                    templateId: draft.templateId ?? null,
                    title: draft.title,
                    updatedAt: draft.updatedAt,
                }),
            clearDraft: () => set({ workoutId: null, templateId: null, title: null, updatedAt: 0 }),
            abandonDraft: () => {
                const id = useWorkoutSessionDraftStore.getState().workoutId
                if (id != null) {
                    trackBusinessMetric('abandoned_workout', { workout_id: id })
                }
                set({ workoutId: null, templateId: null, title: null, updatedAt: 0 })
            },
        }),
        { name: 'workout-session-draft' },
    ),
)
