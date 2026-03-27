import { create } from 'zustand'

interface AchievementsUiState {
    showOnlyUnlocked: boolean
    setShowOnlyUnlocked: (showOnlyUnlocked: boolean) => void
}

export const useAchievementsUiStore = create<AchievementsUiState>((set) => ({
    showOnlyUnlocked: false,
    setShowOnlyUnlocked: (showOnlyUnlocked) => set({ showOnlyUnlocked }),
}))
