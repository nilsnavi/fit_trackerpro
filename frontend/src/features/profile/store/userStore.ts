import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@shared/types'

interface UserState {
    user: User | null
    isLoading: boolean
    error: string | null
    setUser: (user: User | null) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    logout: () => void
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            isLoading: false,
            error: null,
            setUser: (user) => set({ user, error: null }),
            setLoading: (isLoading) => set({ isLoading }),
            setError: (error) => set({ error }),
            logout: () => set({ user: null, error: null }),
        }),
        {
            name: 'user-storage',
        }
    )
)
