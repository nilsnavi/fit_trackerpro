import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@shared/types'

/**
 * Зарезервировано под клиентский снимок идентичности (офлайн, миграции).
 *
 * Не подключайте к экранам без отдельного решения: профиль и сессия с API —
 * TanStack Query (useCurrentUserQuery, useProfile, queryKeys.profile.me). Иначе
 * дублирование смысла с серверным кэшем.
 */
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
