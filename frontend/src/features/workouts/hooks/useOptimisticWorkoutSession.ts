import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import type { CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'
import {
    patchHistoryItemSessionFields,
    updateSetInHistoryItem,
    type WorkoutHistoryItemSessionPatch,
} from '@features/workouts/lib/workoutQueryOptimistic'

/**
 * Мгновенно обновляет кэш `historyItem` для активной тренировки (подходы, длительность, метаданные)
 * без ожидания сети. Используется вместе с `useCompleteWorkoutMutation` (у неё свой onMutate при финале).
 */
export function useOptimisticWorkoutSession(workoutId: number, enabled: boolean) {
    const queryClient = useQueryClient()
    const key = queryKeys.workouts.historyItem(workoutId)

    const patchItem = useCallback(
        (recipe: (prev: WorkoutHistoryItem) => WorkoutHistoryItem) => {
            if (!enabled) return
            queryClient.setQueryData<WorkoutHistoryItem>(key, (prev) => {
                if (!prev) return prev
                return recipe(prev)
            })
        },
        [queryClient, key, enabled],
    )

    const updateSet = useCallback(
        (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => {
            patchItem((prev) => updateSetInHistoryItem(prev, exerciseIndex, setNumber, patch))
        },
        [patchItem],
    )

    const updateSessionFields = useCallback(
        (patch: WorkoutHistoryItemSessionPatch) => {
            patchItem((prev) => patchHistoryItemSessionFields(prev, patch))
        },
        [patchItem],
    )

    return { patchItem, updateSet, updateSessionFields }
}
