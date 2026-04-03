/**
 * Zustand store for the workout mode editor.
 *
 * Canonical location: features/workouts/model/useWorkoutModeEditorStore.ts
 * The old path (features/workouts/stores/) re-exports from here for backwards
 * compatibility with existing tests.
 */
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
    EditorWorkoutMode,
    CardioExerciseParams,
    FunctionalExerciseParams,
    StrengthExerciseParams,
    YogaExerciseParams,
    ModeExerciseParams,
    WorkoutModeEditorValidationErrors,
    WorkoutModeEditorValidationKey,
    WorkoutModeExerciseItem,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'

// ── State shape ──────────────────────────────────────────────────────────────

export interface WorkoutModeEditorState {
    mode: EditorWorkoutMode | null
    title: string
    description: string
    exercises: WorkoutModeExerciseItem[]
    isDirty: boolean
    validationErrors: WorkoutModeEditorValidationErrors

    // Setters
    setMode: (mode: EditorWorkoutMode) => void
    setTitle: (title: string) => void
    setDescription: (description: string) => void

    // Exercise CRUD
    addExercise: (exercise: WorkoutModeExerciseItem) => void
    updateExercise: (id: string, patch: Partial<WorkoutModeExerciseItem>) => void
    removeExercise: (id: string) => void
    reorderExercises: (fromIndex: number, toIndex: number) => void

    // Validation
    setValidationError: (key: WorkoutModeEditorValidationKey, message: string) => void
    clearValidationError: (key: WorkoutModeEditorValidationKey) => void
    clearValidationErrors: () => void
    validate: () => boolean

    // Lifecycle
    reset: () => void
    markClean: () => void
}

const initialState = {
    mode: null as EditorWorkoutMode | null,
    title: '',
    description: '',
    exercises: [] as WorkoutModeExerciseItem[],
    isDirty: false,
    validationErrors: {} as WorkoutModeEditorValidationErrors,
}

function validateModeExercise(item: WorkoutModeExerciseItem, index: number): string | null {
    const position = index + 1
    const name = item.name || `упражнение #${position}`

    if (item.mode === 'strength') {
        const params = item.params as StrengthExerciseParams
        if (!Number.isFinite(params.sets) || params.sets < 1) {
            return `Укажите корректные подходы для «${name}» (минимум 1).`
        }
        if (!Number.isFinite(params.reps) || params.reps < 1) {
            return `Укажите корректные повторы для «${name}» (минимум 1).`
        }
        if (!Number.isFinite(params.restSeconds) || params.restSeconds < 0) {
            return `Укажите корректный отдых для «${name}» (не меньше 0 сек).`
        }
        return null
    }

    if (item.mode === 'cardio') {
        const params = item.params as CardioExerciseParams
        if (!Number.isFinite(params.durationSeconds) || params.durationSeconds < 30) {
            return `Для «${name}» в кардио задайте длительность не меньше 30 сек.`
        }
        if (params.distance != null && (!Number.isFinite(params.distance) || params.distance <= 0)) {
            return `Для «${name}» дистанция должна быть больше 0.`
        }
        return null
    }

    if (item.mode === 'functional') {
        const params = item.params as FunctionalExerciseParams
        if (!Number.isFinite(params.rounds) || params.rounds < 1) {
            return `Для «${name}» укажите раунды (минимум 1).`
        }
        if (params.reps != null && (!Number.isFinite(params.reps) || params.reps < 1)) {
            return `Для «${name}» повторы должны быть не меньше 1.`
        }
        if (params.durationSeconds != null && (!Number.isFinite(params.durationSeconds) || params.durationSeconds < 10)) {
            return `Для «${name}» длительность должна быть не меньше 10 сек.`
        }
        if (!Number.isFinite(params.restSeconds) || params.restSeconds < 0) {
            return `Для «${name}» отдых должен быть не меньше 0 сек.`
        }
        if (params.reps == null && params.durationSeconds == null) {
            return `Для «${name}» укажите либо повторы, либо длительность.`
        }
        return null
    }

    if (item.mode === 'yoga') {
        const params = item.params as YogaExerciseParams
        if (!Number.isFinite(params.durationSeconds) || params.durationSeconds < 10) {
            return `Для «${name}» в йоге задайте длительность не меньше 10 сек.`
        }
        return null
    }

    return null
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkoutModeEditorStore = create<WorkoutModeEditorState>()((set, get) => ({
    ...initialState,

    setMode: (mode) =>
        set((s) => ({
            mode,
            isDirty: s.mode !== mode || s.isDirty,
        })),

    setTitle: (title) =>
        set({
            title,
            isDirty: true,
            validationErrors: { ...get().validationErrors, title: undefined },
        }),

    setDescription: (description) => set({ description, isDirty: true }),

    addExercise: (exercise) =>
        set((s) => ({
            exercises: [...s.exercises, exercise],
            isDirty: true,
            validationErrors: { ...s.validationErrors, exercises: undefined },
        })),

    updateExercise: (id, patch) =>
        set((s) => ({
            exercises: s.exercises.map((ex) =>
                ex.id === id ? { ...ex, ...patch } : ex,
            ),
            isDirty: true,
        })),

    removeExercise: (id) =>
        set((s) => ({
            exercises: s.exercises.filter((ex) => ex.id !== id),
            isDirty: true,
        })),

    reorderExercises: (fromIndex, toIndex) =>
        set((s) => {
            const next = [...s.exercises]
            const [moved] = next.splice(fromIndex, 1)
            next.splice(toIndex, 0, moved)
            return { exercises: next, isDirty: true }
        }),

    setValidationError: (key, message) =>
        set((s) => ({
            validationErrors: { ...s.validationErrors, [key]: message },
        })),

    clearValidationError: (key) =>
        set((s) => {
            const next = { ...s.validationErrors }
            delete next[key]
            return { validationErrors: next }
        }),

    clearValidationErrors: () => set({ validationErrors: {} }),

    validate: () => {
        const { title, exercises, setValidationError, clearValidationErrors } = get()
        clearValidationErrors()
        let valid = true

        if (!title.trim()) {
            setValidationError('title', 'Введите название тренировки')
            valid = false
        }
        if (exercises.length === 0) {
            setValidationError('exercises', 'Добавьте хотя бы одно упражнение')
            valid = false
        }
        if (exercises.length > 0) {
            const invalidExerciseMessage = exercises
                .map((exercise, index) => validateModeExercise(exercise, index))
                .find((message): message is string => Boolean(message))

            if (invalidExerciseMessage) {
                setValidationError('exercises', invalidExerciseMessage)
                valid = false
            }
        }
        return valid
    },

    reset: () => set(initialState),
    markClean: () => set({ isDirty: false }),
}))

// ── Selector helpers ─────────────────────────────────────────────────────────

export const selectExerciseById =
    (id: string) =>
    (s: WorkoutModeEditorState): WorkoutModeExerciseItem | undefined =>
        s.exercises.find((ex) => ex.id === id)

/** Imperative helper for non-React call sites (e.g. DnD callbacks). */
export function updateExerciseParams(id: string, params: ModeExerciseParams): void {
    useWorkoutModeEditorStore.getState().updateExercise(id, { params })
}

/**
 * Selects mutable editor state fields in a single subscription.
 * Uses shallow equality so a re-render only occurs when any field value changes.
 */
export function useWorkoutModeEditorStateSlice() {
    return useWorkoutModeEditorStore(
        useShallow((s) => ({
            title: s.title,
            description: s.description,
            exercises: s.exercises,
            isDirty: s.isDirty,
            validationErrors: s.validationErrors,
        })),
    )
}

/**
 * Returns all store actions in a single shallow-stable subscription.
 * Zustand actions are stable — this never triggers a re-render.
 */
export function useWorkoutModeEditorActions() {
    return useWorkoutModeEditorStore(
        useShallow((s) => ({
            setMode: s.setMode,
            setTitle: s.setTitle,
            setDescription: s.setDescription,
            addExercise: s.addExercise,
            updateExercise: s.updateExercise,
            removeExercise: s.removeExercise,
            reorderExercises: s.reorderExercises,
            validate: s.validate,
            reset: s.reset,
        })),
    )
}
