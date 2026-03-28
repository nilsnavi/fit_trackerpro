import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@shared/types'

/** Кэш идентичности пользователя (сессия); актуальный профиль с сервера — через TanStack Query. */
interface UserSessionState {
    user: User | null
    setUser: (user: User | null) => void
    logout: () => void
}

export const useUserStore = create<UserSessionState>()(
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
