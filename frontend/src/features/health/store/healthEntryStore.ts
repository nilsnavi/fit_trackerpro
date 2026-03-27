import { create } from 'zustand'

interface HealthEntryState {
    quickWaterMl: number
    setQuickWaterMl: (quickWaterMl: number) => void
}

export const useHealthEntryStore = create<HealthEntryState>((set) => ({
    quickWaterMl: 250,
    setQuickWaterMl: (quickWaterMl) => set({ quickWaterMl }),
}))
