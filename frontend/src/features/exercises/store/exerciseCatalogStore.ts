import { create } from 'zustand'

interface ExerciseCatalogState {
    search: string
    category: string
    setSearch: (search: string) => void
    setCategory: (category: string) => void
    reset: () => void
}

export const useExerciseCatalogStore = create<ExerciseCatalogState>((set) => ({
    search: '',
    category: 'all',
    setSearch: (search) => set({ search }),
    setCategory: (category) => set({ category }),
    reset: () => set({ search: '', category: 'all' }),
}))
