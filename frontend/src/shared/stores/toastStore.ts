import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'retry'

export interface Toast {
    id: string
    kind: ToastKind
    message: string
    /** Duration in ms. undefined = 3500, 0 = sticky */
    duration?: number
}

interface ToastState {
    toasts: Toast[]
    push: (toast: Omit<Toast, 'id'>) => string
    dismiss: (id: string) => void
    dismissAll: () => void
}

export const useToastStore = create<ToastState>()((set) => ({
    toasts: [],
    push: (toast) => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
        return id
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    dismissAll: () => set({ toasts: [] }),
}))

// Convenience helpers for non-React call sites
export const toast = {
    success: (message: string, duration?: number) =>
        useToastStore.getState().push({ kind: 'success', message, duration }),
    error: (message: string, duration?: number) =>
        useToastStore.getState().push({ kind: 'error', message, duration }),
    info: (message: string, duration?: number) =>
        useToastStore.getState().push({ kind: 'info', message, duration }),
    retry: (message: string, duration?: number) =>
        useToastStore.getState().push({ kind: 'retry', message, duration }),
}
