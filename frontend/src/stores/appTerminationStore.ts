import { create } from 'zustand'

/**
 * Terminal app states that replace the whole UI tree (rendered above the auth gates
 * in `main.tsx`). Once set, it is never reset in this page session.
 *
 * - `account_deleted` — `DELETE /users/me` succeeded. The tree must not stay mounted:
 *   auth gates would re-run the Telegram login, which creates a fresh account
 *   (`POST /users/auth/telegram` is get-or-create), and background sync / query
 *   persistence would keep writing the user's data back to device storage.
 */
export type AppTerminationReason = 'account_deleted'

interface AppTerminationState {
    reason: AppTerminationReason | null
    terminate: (reason: AppTerminationReason) => void
}

export const useAppTerminationStore = create<AppTerminationState>((set) => ({
    reason: null,
    terminate: (reason) => set({ reason }),
}))

/** Non-hook accessor for modules (API client interceptors). */
export function isAppTerminated(): boolean {
    return useAppTerminationStore.getState().reason !== null
}
