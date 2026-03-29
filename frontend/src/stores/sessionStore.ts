import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@shared/types'

/** Кэш идентичности пользователя; актуальный профиль с сервера — через TanStack Query. */
interface SessionState {
    user: User | null
    setUser: (user: User | null) => void
    logout: () => void
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
            logout: () => set({ user: null }),
        }),
        {
            name: 'user-storage',
        },
    ),
)
