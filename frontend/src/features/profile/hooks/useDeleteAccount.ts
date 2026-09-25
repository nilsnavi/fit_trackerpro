/**
 * Account deletion: `DELETE /users/me`, then the app switches into the terminal
 * «Аккаунт удалён» state (see `appTerminationStore`), which wipes device data.
 */
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { usersApi } from '@shared/api/domains/usersApi'
import { useAppTerminationStore } from '@/stores/appTerminationStore'
import { useAuthStore } from '@/stores/authStore'

export interface UseDeleteAccountReturn {
    /** Resolves `true` on success; on failure `error` is set and it resolves `false`. */
    deleteAccount: () => Promise<boolean>
    isDeleting: boolean
    error: unknown
    reset: () => void
}

export function useDeleteAccount(): UseDeleteAccountReturn {
    const queryClient = useQueryClient()
    const { hapticFeedback } = useTelegramWebApp()
    const terminate = useAppTerminationStore((s) => s.terminate)

    const mutation = useMutation({
        mutationFn: () => usersApi.deleteAccount(),
        onSuccess: () => {
            hapticFeedback({ type: 'notification', notificationType: 'success' })
            // Synchronously and in this order: the terminal screen replaces the tree in
            // the same render as the session is dropped, so no auth gate gets a chance
            // to log in again (that would silently create a new account).
            terminate('account_deleted')
            queryClient.clear()
            useAuthStore.getState().clear()
        },
        onError: () => {
            hapticFeedback({ type: 'notification', notificationType: 'error' })
        },
    })

    const { mutateAsync, isPending, error, reset } = mutation

    const deleteAccount = useCallback(async () => {
        try {
            await mutateAsync()
            return true
        } catch {
            return false
        }
    }, [mutateAsync])

    return { deleteAccount, isDeleting: isPending, error, reset }
}
