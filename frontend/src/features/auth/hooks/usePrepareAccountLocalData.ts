import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getQueueSize } from '@shared/offline/offlineQueue'
import { createOfflineQueryPersister } from '@shared/offline/offlineQueryPersist'
import { hasSavedSyncMutations } from '@shared/offline/syncQueue'
import {
    useActiveWorkoutStore,
    useWorkoutDraftStore,
    useWorkoutSessionDraftStore,
    useWorkoutSessionUiStore,
} from '@/state/local'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'

const ACCOUNT_KEY = 'fittracker-device-account'

/** Do not restore another account's cache or send its pending mutations. */
export async function prepareAccountLocalData(
    queryClient: QueryClient,
    userId: number,
    isTelegram: boolean,
): Promise<void> {
    const nextAccount = String(userId)
    const currentAccount = localStorage.getItem(ACCOUNT_KEY)
    if (currentAccount === nextAccount) return

    // Existing Telegram installs used unscoped local data. Adopt it on the first
    // verified Telegram session, as there is no older account marker to compare.
    if (currentAccount !== null || !isTelegram) {
        if (
            getQueueSize() > 0 ||
            hasSavedSyncMutations() ||
            useWorkoutSessionDraftStore.getState().workoutId !== null ||
            useActiveWorkoutSessionDraftStore.getState().getDraft() !== null
        ) {
            throw new Error('На устройстве есть незавершённая тренировка. Войдите в прежний аккаунт и синхронизируйте её.')
        }
        await queryClient.cancelQueries()
        queryClient.clear()
        await createOfflineQueryPersister().removeClient()
        useWorkoutDraftStore.getState().reset()
        useActiveWorkoutStore.getState().reset()
        useWorkoutSessionUiStore.getState().closeExerciseModal()
        useWorkoutSessionUiStore.getState().skipSessionRestTimer()
    }

    localStorage.setItem(ACCOUNT_KEY, nextAccount)
}

export function usePrepareAccountLocalData() {
    const queryClient = useQueryClient()
    useEffect(() => {
        const onAccountChanged = (event: StorageEvent) => {
            if (event.key === ACCOUNT_KEY && event.oldValue !== event.newValue) {
                window.location.reload()
            }
        }
        window.addEventListener('storage', onAccountChanged)
        return () => window.removeEventListener('storage', onAccountChanged)
    }, [])

    return useCallback(
        (id: number, isTelegram: boolean) => prepareAccountLocalData(queryClient, id, isTelegram),
        [queryClient],
    )
}
