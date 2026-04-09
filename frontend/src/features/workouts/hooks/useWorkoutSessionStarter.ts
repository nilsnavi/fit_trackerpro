import { useCallback } from 'react'
import type {
    WorkoutSessionUpdateRequest,
    WorkoutStartRequest,
    WorkoutStartResponse,
} from '@features/workouts/types/workouts'
import { useUpdateWorkoutSessionMutation, useStartWorkoutMutation } from './useWorkoutMutations'
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
                    started.template_id ?? draft?.templateId ?? startPayload.template_id ?? null

                setWorkoutSessionDraft(started.id, draftTitle, draftTemplateId)
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
