import { useCallback } from 'react'
import type {
    WorkoutSessionUpdateRequest,
    WorkoutStartRequest,
    WorkoutStartResponse,
} from '@features/workouts/types/workouts'
import { useUpdateWorkoutSessionMutation, useStartWorkoutMutation } from './useWorkoutMutations'
import { getStartTemplateId } from '@features/workouts/lib/workoutQueryOptimistic'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue'
import { toast } from '@shared/stores/toastStore'

export type StartWorkoutSessionParams = {
    startPayload: WorkoutStartRequest
    patchPayload?: WorkoutSessionUpdateRequest
    draft?: {
        title?: string
        templateId?: number | null
    }
    onOfflineQueued?: () => void
}

export function useWorkoutSessionStarter() {
    const startWorkoutMutation = useStartWorkoutMutation()
    const updateWorkoutSessionMutation = useUpdateWorkoutSessionMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)
    const setActiveSession = useWorkoutSessionDraftStore((s) => s.setActiveSession)

    const startWorkoutSession = useCallback(
        async (params: StartWorkoutSessionParams): Promise<WorkoutStartResponse | null> => {
            const { startPayload, patchPayload, draft, onOfflineQueued } = params
            try {
                const started = await startWorkoutMutation.mutateAsync(startPayload)

                if (patchPayload) {
                    await updateWorkoutSessionMutation.mutateAsync({
                        workoutId: started.id,
                        payload: patchPayload,
                    })
                }

                const fallbackTitle = startPayload.name?.trim() || `Тренировка #${started.id}`
                const draftTitle = draft?.title?.trim() || fallbackTitle
                const draftTemplateId =
                    started.template_id ?? draft?.templateId ?? getStartTemplateId(startPayload) ?? null
                const sourceType =
                    started.source_type ??
                    startPayload.source_type ??
                    (getStartTemplateId(startPayload) != null ? 'personal_template' : 'quick_start')

                setWorkoutSessionDraft(started.id, draftTitle, draftTemplateId)
                setActiveSession({
                    id: started.id,
                    title: draftTitle,
                    templateId: draftTemplateId,
                    sourceType,
                    sourceId: started.source_id ?? startPayload.source_id ?? getStartTemplateId(startPayload) ?? null,
                    startedAt: Date.now(),
                })
                return started
            } catch (err) {
                if (isOfflineMutationQueuedError(err)) {
                    toast.info('Старт тренировки в очереди — отправим при восстановлении сети')
                    onOfflineQueued?.()
                    return null
                }
                throw err
            }
        },
        [
            setWorkoutSessionDraft,
            setActiveSession,
            startWorkoutMutation,
            updateWorkoutSessionMutation,
        ],
    )

    return {
        startWorkoutSession,
        isStartingSession:
            startWorkoutMutation.isPending || updateWorkoutSessionMutation.isPending,
    }
}
