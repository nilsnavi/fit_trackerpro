import { useCallback, useState } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import { buildRepeatExercises } from '@features/workouts/lib/workoutModeHelpers'
import type {
    CompletedExercise,
    CompletedSet,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'
import { toast } from '@shared/stores/toastStore'
import { AddItemKind, ExerciseCatalogFilter, nextExerciseId } from '../lib/activeWorkoutUtils'

type PatchItemFn = (updater: (prev: WorkoutHistoryItem) => WorkoutHistoryItem) => void
type UpdateSetFn = (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
type SetCurrentPositionFn = (exerciseIndex: number, setIndex: number) => void

export interface UseActiveWorkoutExerciseActionsParams {
    workout: WorkoutHistoryItem | undefined
    isActiveDraft: boolean
    queryWorkout: WorkoutHistoryItem | null
    setSessionError: (value: string | null) => void
    patchItem: PatchItemFn
    updateSet: UpdateSetFn
    setCurrentPosition: SetCurrentPositionFn
    currentExerciseIndex: number
    currentSetIndex: number
    currentExercise: CompletedExercise | null
    previousBestByExercise: Map<string, CompletedSet>
    repeatSource: WorkoutHistoryItem | null
    tg: UseTelegramWebAppReturn
}

export interface UseActiveWorkoutExerciseActionsResult {
    addItemKind: AddItemKind | null
    addItemName: string
    addItemSets: string
    addItemReps: string
    addItemWeight: string
    addItemDuration: string
    addItemNotes: string
    exerciseSearchQuery: string
    selectedCatalogExercise: CatalogExercise | null
    exerciseCatalogFilter: ExerciseCatalogFilter
    resetAddItemForm: (kind: AddItemKind) => void
    closeAddItemModal: () => void
    setAddItemName: (value: string) => void
    setAddItemSets: (value: string) => void
    setAddItemReps: (value: string) => void
    setAddItemWeight: (value: string) => void
    setAddItemDuration: (value: string) => void
    setAddItemNotes: (value: string) => void
    setExerciseSearchQuery: (value: string) => void
    setSelectedCatalogExercise: (value: CatalogExercise | null) => void
    setExerciseCatalogFilter: (value: ExerciseCatalogFilter) => void
    handleCreateItem: () => void
    handleDragEnd: (event: DragEndEvent) => void
    handleCopyPreviousSet: (exerciseIndex: number, setNumber: number) => void
    handleAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    handleAddSetToCurrentExercise: () => void
    handleRemoveLastSetFromCurrentExercise: () => void
    handleRepeatPrevious: () => void
    isDeleteExerciseConfirmOpen: boolean
    pendingDeleteExerciseIndex: number | null
    handleDeleteExerciseRequest: (exerciseIndex: number) => void
    closeDeleteExerciseConfirm: () => void
    handleConfirmDeleteExercise: () => void
    handleExerciseNotesChange: (exerciseIndex: number, notes: string | undefined) => void
}

export function useActiveWorkoutExerciseActions({
    workout,
    isActiveDraft,
    queryWorkout,
    setSessionError,
    patchItem,
    updateSet,
    setCurrentPosition,
    currentExerciseIndex,
    currentSetIndex,
    currentExercise,
    previousBestByExercise,
    repeatSource,
    tg,
}: UseActiveWorkoutExerciseActionsParams): UseActiveWorkoutExerciseActionsResult {
    const [addItemKind, setAddItemKind] = useState<AddItemKind | null>(null)
    const [addItemName, setAddItemName] = useState<string>('')
    const [addItemSets, setAddItemSets] = useState<string>('3')
    const [addItemReps, setAddItemReps] = useState<string>('10')
    const [addItemWeight, setAddItemWeight] = useState<string>('')
    const [addItemDuration, setAddItemDuration] = useState<string>('60')
    const [addItemNotes, setAddItemNotes] = useState<string>('')
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState<string>('')
    const [selectedCatalogExercise, setSelectedCatalogExercise] = useState<CatalogExercise | null>(null)
    const [exerciseCatalogFilter, setExerciseCatalogFilter] = useState<ExerciseCatalogFilter>('all')

    const [isDeleteExerciseConfirmOpen, setIsDeleteExerciseConfirmOpen] = useState<boolean>(false)
    const [pendingDeleteExerciseIndex, setPendingDeleteExerciseIndex] = useState<number | null>(null)

    const resetAddItemForm = useCallback((kind: AddItemKind) => {
        setAddItemKind(kind)
        setAddItemName('')
        setAddItemSets(kind === 'timer' ? '1' : '3')
        setAddItemReps(kind === 'timer' ? '' : '10')
        setAddItemWeight('')
        setAddItemDuration(kind === 'timer' ? '60' : '')
        setAddItemNotes('')
        setExerciseSearchQuery('')
        setExerciseCatalogFilter('all')
        setSelectedCatalogExercise(null)
        setSessionError(null)
    }, [setSessionError])

    const closeAddItemModal = useCallback(() => {
        setAddItemKind(null)
    }, [])

    const handleCreateItem = useCallback(() => {
        const current = queryWorkout
        if (!current || !addItemKind) return

        const name = addItemKind === 'exercise'
            ? selectedCatalogExercise?.name.trim() ?? ''
            : addItemName.trim()

        if (!name) {
            setSessionError(addItemKind === 'timer' ? 'Введите название таймера' : 'Выберите упражнение из каталога')
            return
        }

        const sets = Math.max(1, Number.parseInt(addItemSets, 10) || 1)
        const reps = parseOptionalNumber(addItemReps)
        const weight = parseOptionalNumber(addItemWeight)
        const duration = parseOptionalNumber(addItemDuration)

        if (addItemKind === 'timer' && (duration == null || duration < 1)) {
            setSessionError('Для таймера укажите длительность в секундах')
            return
        }

        const exerciseId = nextExerciseId(current.exercises)
        const nextExercise: CompletedExercise = {
            exercise_id: addItemKind === 'exercise' ? selectedCatalogExercise?.id ?? exerciseId : exerciseId,
            name,
            notes: addItemNotes.trim() || undefined,
            sets_completed: Array.from({ length: addItemKind === 'timer' ? 1 : sets }, (_, index) => ({
                set_number: index + 1,
                reps: addItemKind === 'timer' ? undefined : reps,
                weight: addItemKind === 'timer' ? undefined : weight,
                duration,
                distance: undefined,
                completed: false,
            })),
        }

        tg.hapticFeedback({ type: 'impact', style: 'light' })
        patchItem((prev) => ({
            ...prev,
            exercises: [...prev.exercises, nextExercise],
        }))

        closeAddItemModal()
    }, [
        addItemDuration,
        addItemKind,
        addItemName,
        addItemNotes,
        addItemReps,
        addItemSets,
        addItemWeight,
        closeAddItemModal,
        patchItem,
        queryWorkout,
        selectedCatalogExercise,
        setSessionError,
        tg,
    ])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        if (!isActiveDraft) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        patchItem((prev) => {
            const oldIndex = prev.exercises.findIndex((exercise, index) => `${exercise.exercise_id}-${index}` === active.id)
            const newIndex = prev.exercises.findIndex((exercise, index) => `${exercise.exercise_id}-${index}` === over.id)
            if (oldIndex < 0 || newIndex < 0) return prev
            return {
                ...prev,
                exercises: arrayMove(prev.exercises, oldIndex, newIndex),
            }
        })
    }, [isActiveDraft, patchItem])

    const getPreviousSetValues = useCallback((exercise: CompletedExercise, setNumber: number): Partial<CompletedSet> => {
        const previousInExercise = exercise.sets_completed[setNumber - 2]
        if (previousInExercise) {
            return {
                weight: previousInExercise.weight,
                reps: previousInExercise.reps,
                duration: previousInExercise.duration,
                distance: previousInExercise.distance,
            }
        }

        const previousBest = previousBestByExercise.get(exercise.name)
        if (!previousBest) {
            return {}
        }

        return {
            weight: previousBest.weight,
            reps: previousBest.reps,
            duration: previousBest.duration,
            distance: previousBest.distance,
        }
    }, [previousBestByExercise])

    const handleCopyPreviousSet = useCallback((exerciseIndex: number, setNumber: number) => {
        const exercise = workout?.exercises[exerciseIndex]
        if (!exercise) return

        const previous = getPreviousSetValues(exercise, setNumber)
        if (
            previous.weight == null &&
            previous.reps == null &&
            previous.duration == null &&
            previous.distance == null
        ) {
            return
        }

        tg.hapticFeedback({ type: 'selection' })
        updateSet(exerciseIndex, setNumber, previous)
    }, [getPreviousSetValues, tg, updateSet, workout?.exercises])

    const handleAdjustWeight = useCallback((exerciseIndex: number, setNumber: number, delta: number) => {
        const exercise = workout?.exercises[exerciseIndex]
        const targetSet = exercise?.sets_completed.find((item) => item.set_number === setNumber)
        const currentWeight = targetSet?.weight ?? 0
        const nextWeight = Math.max(0, Number((currentWeight + delta).toFixed(2)))
        updateSet(exerciseIndex, setNumber, { weight: nextWeight })
    }, [updateSet, workout?.exercises])

    const handleAddSetToCurrentExercise = useCallback(() => {
        if (!workout || !currentExercise) return

        const nextSetNumber = currentExercise.sets_completed.length + 1
        const previousValues = getPreviousSetValues(currentExercise, nextSetNumber)

        tg.hapticFeedback({ type: 'selection' })
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((exercise, index) => {
                if (index !== currentExerciseIndex) return exercise

                return {
                    ...exercise,
                    sets_completed: [
                        ...exercise.sets_completed,
                        {
                            set_number: nextSetNumber,
                            completed: false,
                            reps: previousValues.reps,
                            weight: previousValues.weight,
                            duration: previousValues.duration,
                            distance: previousValues.distance,
                        },
                    ],
                }
            }),
        }))

        setCurrentPosition(currentExerciseIndex, nextSetNumber - 1)
    }, [
        currentExercise,
        currentExerciseIndex,
        getPreviousSetValues,
        patchItem,
        setCurrentPosition,
        tg,
        workout,
    ])

    const handleRemoveLastSetFromCurrentExercise = useCallback(() => {
        if (!workout || !currentExercise) return
        if (currentExercise.sets_completed.length <= 1) return

        tg.hapticFeedback({ type: 'impact', style: 'light' })
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((exercise, index) => {
                if (index !== currentExerciseIndex) return exercise

                return {
                    ...exercise,
                    sets_completed: exercise.sets_completed.slice(0, -1),
                }
            }),
        }))

        const nextSetIndex = Math.min(currentSetIndex, Math.max(0, currentExercise.sets_completed.length - 2))
        setCurrentPosition(currentExerciseIndex, nextSetIndex)
    }, [currentExercise, currentExerciseIndex, currentSetIndex, patchItem, setCurrentPosition, tg, workout])

    const handleRepeatPrevious = useCallback(() => {
        if (!repeatSource) return
        tg.hapticFeedback({ type: 'selection' })
        patchItem((prev) => ({
            ...prev,
            comments: repeatSource.comments,
            tags: repeatSource.tags ?? prev.tags,
            exercises: buildRepeatExercises(repeatSource.exercises),
        }))
    }, [patchItem, repeatSource, tg])

    const handleDeleteExerciseRequest = useCallback((exerciseIndex: number) => {
        setPendingDeleteExerciseIndex(exerciseIndex)
        setIsDeleteExerciseConfirmOpen(true)
    }, [])

    const closeDeleteExerciseConfirm = useCallback(() => {
        setIsDeleteExerciseConfirmOpen(false)
        setPendingDeleteExerciseIndex(null)
    }, [])

    const handleConfirmDeleteExercise = useCallback(() => {
        if (pendingDeleteExerciseIndex == null) {
            setIsDeleteExerciseConfirmOpen(false)
            return
        }

        tg.hapticFeedback({ type: 'impact', style: 'heavy' })
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((_, index) => index !== pendingDeleteExerciseIndex),
        }))

        setPendingDeleteExerciseIndex(null)
        setIsDeleteExerciseConfirmOpen(false)
        toast.info(navigator.onLine ? 'Упражнение удалено' : 'Упражнение удалено (сохранено локально)')
    }, [patchItem, pendingDeleteExerciseIndex, tg])

    const handleExerciseNotesChange = useCallback((exerciseIndex: number, notes: string | undefined) => {
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item, index) => (
                index === exerciseIndex ? { ...item, notes } : item
            )),
        }))
    }, [patchItem])

    return {
        addItemKind,
        addItemName,
        addItemSets,
        addItemReps,
        addItemWeight,
        addItemDuration,
        addItemNotes,
        exerciseSearchQuery,
        selectedCatalogExercise,
        exerciseCatalogFilter,
        resetAddItemForm,
        closeAddItemModal,
        setAddItemName,
        setAddItemSets,
        setAddItemReps,
        setAddItemWeight,
        setAddItemDuration,
        setAddItemNotes,
        setExerciseSearchQuery,
        setSelectedCatalogExercise,
        setExerciseCatalogFilter,
        handleCreateItem,
        handleDragEnd,
        handleCopyPreviousSet,
        handleAdjustWeight,
        handleAddSetToCurrentExercise,
        handleRemoveLastSetFromCurrentExercise,
        handleRepeatPrevious,
        isDeleteExerciseConfirmOpen,
        pendingDeleteExerciseIndex,
        handleDeleteExerciseRequest,
        closeDeleteExerciseConfirm,
        handleConfirmDeleteExercise,
        handleExerciseNotesChange,
    }
}

