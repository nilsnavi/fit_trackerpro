import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { trackBusinessMetric } from '@shared/lib/businessMetrics'
import { emitWorkoutSyncTelemetry } from '@shared/offline/observability/workoutSyncTelemetry'
import type { WorkoutSessionSourceType } from '@features/workouts/types/workouts'

export interface ActiveWorkoutSessionState {
    id: number
    title: string
    templateId: number | null
    sourceType: WorkoutSessionSourceType
    sourceId: number | null
    startedAt: number
}

/** Черновик активной тренировки на клиенте; серверная история — `queryKeys.workouts.*` и мутации в `useWorkoutMutations`. */
interface WorkoutSessionDraftState {
    workoutId: number | null
    templateId: number | null
    title: string | null
    updatedAt: number
    activeSession: ActiveWorkoutSessionState | null
    setDraft: (workoutId: number, title: string, templateId?: number | null) => void
    setActiveSession: (session: ActiveWorkoutSessionState) => void
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
            activeSession: null,
            setDraft: (workoutId, title, templateId = null) => {
                const updatedAt = Date.now()
                set((state) => ({
                    workoutId,
                    title,
                    templateId,
                    updatedAt,
                    activeSession: state.activeSession?.id === workoutId
                        ? { ...state.activeSession, title, templateId, startedAt: state.activeSession.startedAt || updatedAt }
                        : state.activeSession,
                }))
                emitWorkoutSyncTelemetry('draft_initialized', {
                    source: 'client_set',
                    workout_id: workoutId,
                    ...(templateId != null ? { template_id: templateId } : {}),
                })
            },
            setActiveSession: (session) => {
                set({
                    activeSession: session,
                    workoutId: session.id,
                    title: session.title,
                    templateId: session.templateId,
                    updatedAt: Date.now(),
                })
            },
            hydrateFromRemote: (draft) => {
                set({
                    workoutId: draft.workoutId,
                    templateId: draft.templateId ?? null,
                    title: draft.title,
                    updatedAt: draft.updatedAt,
                })
                emitWorkoutSyncTelemetry('draft_initialized', {
                    source: 'remote',
                    workout_id: draft.workoutId,
                    ...(draft.templateId != null ? { template_id: draft.templateId } : {}),
                })
            },
            clearDraft: () => set({ workoutId: null, templateId: null, title: null, updatedAt: 0, activeSession: null }),
            abandonDraft: () => {
                const id = useWorkoutSessionDraftStore.getState().workoutId
                if (id != null) {
                    trackBusinessMetric('abandoned_workout', { workout_id: id })
                }
                set({ workoutId: null, templateId: null, title: null, updatedAt: 0, activeSession: null })
            },
        }),
        { name: 'workout-session-draft' },
    ),
)
