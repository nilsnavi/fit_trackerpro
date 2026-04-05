import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { WorkoutType } from '@shared/types'
import type { WorkoutBlock } from '@features/workouts/types/workoutBuilder'

export type TemplateEditorValidationKey = 'name' | 'blocks' | 'general'
export type TemplateEditorValidationErrors = Partial<Record<TemplateEditorValidationKey, string>>

interface TemplateEditorHydratePayload {
    id: number | null
    name: string
    description: string
    types: WorkoutType[]
    blocks: WorkoutBlock[]
}

interface TemplateEditorState {
    id: number | null
    name: string
    description: string
    types: WorkoutType[]
    blocks: WorkoutBlock[]
    isDirty: boolean
    validationErrors: TemplateEditorValidationErrors

    hydrate: (payload: TemplateEditorHydratePayload) => void
    reset: () => void
    markClean: () => void

    setName: (name: string) => void
    setDescription: (description: string) => void
    setTypes: (types: WorkoutType[]) => void
    toggleType: (type: WorkoutType) => void

    setBlocks: (blocks: WorkoutBlock[]) => void
    clearBlocks: () => void
    addBlock: (block: WorkoutBlock) => void
    updateBlock: (block: WorkoutBlock) => void
    removeBlock: (blockId: string) => void
    reorderBlocks: (fromIndex: number, toIndex: number) => void
    moveBlockUp: (index: number) => void
    moveBlockDown: (index: number) => void

    setValidationError: (key: TemplateEditorValidationKey, message: string) => void
    clearValidationError: (key: TemplateEditorValidationKey) => void
    clearValidationErrors: () => void
}

const initialState = {
    id: null,
    name: '',
    description: '',
    types: [] as WorkoutType[],
    blocks: [] as WorkoutBlock[],
    isDirty: false,
    validationErrors: {} as TemplateEditorValidationErrors,
}

const withOrder = (blocks: WorkoutBlock[]) =>
    blocks.map((block, index) => ({
        ...block,
        order: index,
    }))

export const useTemplateEditorStore = create<TemplateEditorState>()((set) => ({
    ...initialState,

    hydrate: ({ id, name, description, types, blocks }) =>
        set({
            id,
            name,
            description,
            types,
            blocks: withOrder(blocks),
            isDirty: false,
            validationErrors: {},
        }),

    reset: () => set(initialState),
    markClean: () => set({ isDirty: false }),

    setName: (name) =>
        set((state) => ({
            name,
            isDirty: state.name !== name ? true : state.isDirty,
        })),

    setDescription: (description) =>
        set((state) => ({
            description,
            isDirty: state.description !== description ? true : state.isDirty,
        })),

    setTypes: (types) =>
        set({
            types,
            isDirty: true,
        }),

    toggleType: (type) =>
        set((state) => {
            const nextTypes = state.types.includes(type)
                ? state.types.filter((item) => item !== type)
                : [...state.types, type]
            return {
                types: nextTypes,
                isDirty: true,
            }
        }),

    setBlocks: (blocks) =>
        set({
            blocks: withOrder(blocks),
            isDirty: true,
        }),

    clearBlocks: () =>
        set({
            blocks: [],
            isDirty: true,
        }),

    addBlock: (block) =>
        set((state) => ({
            blocks: withOrder([...state.blocks, block]),
            isDirty: true,
        })),

    updateBlock: (block) =>
        set((state) => ({
            blocks: withOrder(state.blocks.map((item) => (item.id === block.id ? block : item))),
            isDirty: true,
        })),

    removeBlock: (blockId) =>
        set((state) => ({
            blocks: withOrder(state.blocks.filter((item) => item.id !== blockId)),
            isDirty: true,
        })),

    reorderBlocks: (fromIndex, toIndex) =>
        set((state) => {
            if (
                fromIndex < 0 ||
                toIndex < 0 ||
                fromIndex >= state.blocks.length ||
                toIndex >= state.blocks.length
            ) {
                return state
            }
            const nextBlocks = [...state.blocks]
            const [moved] = nextBlocks.splice(fromIndex, 1)
            nextBlocks.splice(toIndex, 0, moved)
            return {
                blocks: withOrder(nextBlocks),
                isDirty: true,
            }
        }),

    moveBlockUp: (index) =>
        set((state) => {
            if (index <= 0 || index >= state.blocks.length) return state
            const nextBlocks = [...state.blocks]
            ;[nextBlocks[index - 1], nextBlocks[index]] = [nextBlocks[index], nextBlocks[index - 1]]
            return {
                blocks: withOrder(nextBlocks),
                isDirty: true,
            }
        }),

    moveBlockDown: (index) =>
        set((state) => {
            if (index < 0 || index >= state.blocks.length - 1) return state
            const nextBlocks = [...state.blocks]
            ;[nextBlocks[index], nextBlocks[index + 1]] = [nextBlocks[index + 1], nextBlocks[index]]
            return {
                blocks: withOrder(nextBlocks),
                isDirty: true,
            }
        }),

    setValidationError: (key, message) =>
        set((state) => ({
            validationErrors: {
                ...state.validationErrors,
                [key]: message,
            },
        })),

    clearValidationError: (key) =>
        set((state) => {
            const nextErrors = { ...state.validationErrors }
            delete nextErrors[key]
            return {
                validationErrors: nextErrors,
            }
        }),

    clearValidationErrors: () => set({ validationErrors: {} }),
}))

/**
 * Selects mutable editor state fields in a single subscription.
 * Uses shallow equality to avoid re-rendering on unrelated store updates.
 */
export function useTemplateEditorStateSlice() {
    return useTemplateEditorStore(
        useShallow((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            types: s.types,
            blocks: s.blocks,
            isDirty: s.isDirty,
            validationErrors: s.validationErrors,
        })),
    )
}

/**
 * Returns all store actions in one shallow-stable subscription.
 * Actions are stable references, so this avoids unnecessary component updates.
 */
export function useTemplateEditorActions() {
    return useTemplateEditorStore(
        useShallow((s) => ({
            hydrate: s.hydrate,
            reset: s.reset,
            markClean: s.markClean,
            setName: s.setName,
            setDescription: s.setDescription,
            setTypes: s.setTypes,
            toggleType: s.toggleType,
            setBlocks: s.setBlocks,
            clearBlocks: s.clearBlocks,
            addBlock: s.addBlock,
            updateBlock: s.updateBlock,
            removeBlock: s.removeBlock,
            reorderBlocks: s.reorderBlocks,
            moveBlockUp: s.moveBlockUp,
            moveBlockDown: s.moveBlockDown,
            setValidationError: s.setValidationError,
            clearValidationError: s.clearValidationError,
            clearValidationErrors: s.clearValidationErrors,
        })),
    )
}
