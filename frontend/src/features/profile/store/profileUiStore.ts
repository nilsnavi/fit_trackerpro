import { create } from 'zustand'

interface ProfileUiState {
    isCoachModalOpen: boolean
    setCoachModalOpen: (isCoachModalOpen: boolean) => void
}

export const useProfileUiStore = create<ProfileUiState>((set) => ({
    isCoachModalOpen: false,
    setCoachModalOpen: (isCoachModalOpen) => set({ isCoachModalOpen }),
}))
