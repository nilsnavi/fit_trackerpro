import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkoutTemplatePinsState {
    pinnedTemplateIds: number[]
    togglePinnedTemplate: (templateId: number) => void
    isPinnedTemplate: (templateId: number) => boolean
}

export const useWorkoutTemplatePinsStore = create<WorkoutTemplatePinsState>()(
    persist(
        (set, get) => ({
            pinnedTemplateIds: [],
            togglePinnedTemplate: (templateId) =>
                set((state) => {
                    const exists = state.pinnedTemplateIds.includes(templateId)
                    if (!exists && state.pinnedTemplateIds.length >= 5) {
                        return state
                    }
                    return {
                        pinnedTemplateIds: exists
                            ? state.pinnedTemplateIds.filter((id) => id !== templateId)
                            : [templateId, ...state.pinnedTemplateIds],
                    }
                }),
            isPinnedTemplate: (templateId) => get().pinnedTemplateIds.includes(templateId),
        }),
        { name: 'workout-template-pins-store' },
    ),
)