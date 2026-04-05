import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'retry' | 'sync'

export type ToastAction = {
    label: string
    onClick: () => void
}

export type ToastOptions = {
    /** Duration in ms. undefined = 3500, 0 = sticky */
    duration?: number
    /** Optional dedupe key: when present, toast can be updated in-place via upsertByKey. */
    toastKey?: string
    action?: ToastAction
}

export type SyncStatusKind = 'offline' | 'syncing' | 'queued' | 'failed' | 'synced'

export type SyncStatusOptions = {
    queuedCount?: number
    failedCount?: number
    retryInSec?: number
    onRetryNow?: () => void
}

const SYNC_STATUS_TOAST_KEY = 'global-sync-status'

export interface Toast {
    id: string
    kind: ToastKind
    message: string
    /** Duration in ms. undefined = 3500, 0 = sticky */
    duration?: number
    toastKey?: string
    action?: ToastAction
}

interface ToastState {
    toasts: Toast[]
    push: (toast: Omit<Toast, 'id'>) => string
    upsertByKey: (toastKey: string, toast: Omit<Toast, 'id' | 'toastKey'>) => string
    dismiss: (id: string) => void
    dismissByKey: (toastKey: string) => void
    dismissAll: () => void
}

export const useToastStore = create<ToastState>()((set) => ({
    toasts: [],
    push: (toast) => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
        return id
    },
    upsertByKey: (toastKey, toast) => {
        const id = crypto.randomUUID()
        set((s) => {
            const index = s.toasts.findIndex((t) => t.toastKey === toastKey)
            if (index === -1) {
                return { toasts: [...s.toasts, { ...toast, id, toastKey }] }
            }

            const next = [...s.toasts]
            next[index] = {
                ...next[index],
                ...toast,
                toastKey,
            }
            return { toasts: next }
        })
        return id
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    dismissByKey: (toastKey) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.toastKey !== toastKey) })),
    dismissAll: () => set({ toasts: [] }),
}))

function resolveOptions(optionsOrDuration?: number | ToastOptions): ToastOptions {
    if (typeof optionsOrDuration === 'number') {
        return { duration: optionsOrDuration }
    }
    return optionsOrDuration ?? {}
}

function syncStatusPayload(kind: SyncStatusKind, options?: SyncStatusOptions): Omit<Toast, 'id'> {
    switch (kind) {
        case 'offline': {
            const queued = options?.queuedCount ?? 0
            return {
                kind: 'sync',
                message:
                    queued > 0
                        ? `Офлайн: изменения сохранены локально (в очереди: ${queued}).`
                        : 'Офлайн: работаем из локального кэша до восстановления сети.',
                duration: 0,
                toastKey: SYNC_STATUS_TOAST_KEY,
            }
        }
        case 'syncing': {
            const queued = options?.queuedCount ?? 0
            return {
                kind: 'sync',
                message:
                    queued > 0
                        ? `Синхронизация с сервером... Осталось операций: ${queued}.`
                        : 'Синхронизация с сервером...',
                duration: 0,
                toastKey: SYNC_STATUS_TOAST_KEY,
            }
        }
        case 'queued': {
            const queued = options?.queuedCount ?? 0
            const retryInSec = options?.retryInSec ?? 0
            return {
                kind: 'sync',
                message:
                    retryInSec > 0
                        ? `Ожидание повтора отправки: ${retryInSec} с. В очереди: ${queued}.`
                        : `Изменения ждут отправки. В очереди: ${queued}.`,
                duration: 0,
                toastKey: SYNC_STATUS_TOAST_KEY,
            }
        }
        case 'failed': {
            const failedCount = options?.failedCount ?? 0
            return {
                kind: 'error',
                message:
                    failedCount > 0
                        ? `Не удалось синхронизировать ${failedCount} операций.`
                        : 'Не удалось синхронизировать изменения.',
                duration: 0,
                toastKey: SYNC_STATUS_TOAST_KEY,
                action: options?.onRetryNow
                    ? {
                          label: 'Повторить сейчас',
                          onClick: options.onRetryNow,
                      }
                    : undefined,
            }
        }
        case 'synced':
        default:
            return {
                kind: 'success',
                message: 'Синхронизация завершена',
                duration: 2200,
                toastKey: SYNC_STATUS_TOAST_KEY,
            }
    }
}

// Convenience helpers for non-React call sites
export const toast = {
    success: (message: string, optionsOrDuration?: number | ToastOptions) =>
        useToastStore.getState().push({ kind: 'success', message, ...resolveOptions(optionsOrDuration) }),
    error: (message: string, optionsOrDuration?: number | ToastOptions) =>
        useToastStore.getState().push({ kind: 'error', message, ...resolveOptions(optionsOrDuration) }),
    info: (message: string, optionsOrDuration?: number | ToastOptions) =>
        useToastStore.getState().push({ kind: 'info', message, ...resolveOptions(optionsOrDuration) }),
    retry: (
        message: string,
        retryOrDuration?: (() => void) | number,
        options?: ToastOptions,
    ) => {
        if (typeof retryOrDuration === 'function') {
            return useToastStore.getState().push({
                kind: 'retry',
                message,
                duration: options?.duration,
                toastKey: options?.toastKey,
                action: options?.action ?? {
                    label: 'Повторить',
                    onClick: retryOrDuration,
                },
            })
        }

        const resolved = resolveOptions(retryOrDuration)
        return useToastStore.getState().push({ kind: 'retry', message, ...resolved })
    },
    syncStatus: (kind: SyncStatusKind, options?: SyncStatusOptions) => {
        const state = useToastStore.getState()
        const payload = syncStatusPayload(kind, options)
        return state.upsertByKey(SYNC_STATUS_TOAST_KEY, payload)
    },
    clearSyncStatus: () => useToastStore.getState().dismissByKey(SYNC_STATUS_TOAST_KEY),
}
