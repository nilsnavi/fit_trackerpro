import { create } from 'zustand'

type AnalyticsRange = '7d' | '30d' | '90d' | '1y'

interface AnalyticsViewState {
    range: AnalyticsRange
    setRange: (range: AnalyticsRange) => void
}

export const useAnalyticsViewStore = create<AnalyticsViewState>((set) => ({
    range: '30d',
    setRange: (range) => set({ range }),
}))
