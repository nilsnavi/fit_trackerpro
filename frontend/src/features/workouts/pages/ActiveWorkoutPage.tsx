import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { Plus, Timer } from 'lucide-react'
import { UnsavedChangesModal } from '@shared/ui/UnsavedChangesModal'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import {
    useCompleteWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard'
import { toast } from '@shared/stores/toastStore'
import { getErrorMessage } from '@shared/errors'
import { queryKeys } from '@shared/api/queryKeys'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import { buildRepeatExercises } from '@features/workouts/lib/workoutModeHelpers'
import { CurrentExerciseCard } from '@features/workouts/components'
import { useActiveWorkoutActions, useActiveWorkoutStore, useWorkoutSessionDraftStore } from '@/state/local'
import { ActiveWorkoutHeader } from '@features/workouts/active/components/ActiveWorkoutHeader'
import { SessionSummaryCard } from '@features/workouts/active/components/SessionSummaryCard'
import { RestTimerPanel } from '@features/workouts/active/components/RestTimerPanel'
import { SessionNavigationPanel } from '@features/workouts/active/components/SessionNavigationPanel'
import { ActiveExerciseList } from '@features/workouts/active/components/ActiveExerciseList'
import { AddExerciseModal } from '@features/workouts/active/modals/AddExerciseModal'
import { AddTimerModal } from '@features/workouts/active/modals/AddTimerModal'
import { ExerciseStructureEditorModal } from '@features/workouts/active/modals/ExerciseStructureEditorModal'
import { FinishWorkoutModal } from '@features/workouts/active/modals/FinishWorkoutModal'
import { AbandonWorkoutConfirmModal } from '@features/workouts/active/modals/AbandonWorkoutConfirmModal'
import { WorkoutConfirmModal } from '@features/workouts/components/WorkoutConfirmModal'
import { useActiveWorkoutSync } from '@features/workouts/active/hooks/useActiveWorkoutSync'
import { useWorkoutNavigation } from '@features/workouts/active/hooks/useWorkoutNavigation'
import { useWorkoutStructureEditor } from '@features/workouts/active/hooks/useWorkoutStructureEditor'
import type {
    CompletedSet,
    CompletedExercise,
    WorkoutCompleteRequest,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'

type AddItemKind = 'exercise' | 'timer'
type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility'

function parseTagsInput(value: string): string[] {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
}

const REST_PRESETS_SECONDS = [45, 60, 90, 120, 180]

function buildSyncPayload(workout: WorkoutHistoryItem): WorkoutSessionUpdateRequest {
    return {
        exercises: workout.exercises,
        comments: workout.comments,
        tags: workout.tags ?? [],
        glucose_before: workout.glucose_before,
        glucose_after: workout.glucose_after,
    }
}

export function ActiveWorkoutPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()

    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)
    const abandonWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.abandonDraft)

    const activeExercises = useActiveWorkoutStore((s) => s.exercises)
    const currentExerciseIndex = useActiveWorkoutStore((s) => s.currentExerciseIndex)
    const currentSetIndex = useActiveWorkoutStore((s) => s.currentSetIndex)
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const startedAt = useActiveWorkoutStore((s) => s.startedAt)

    const {
        initializeSession: initializeActiveSession,
        setExercises: setActiveExercises,
        setElapsedSeconds: setActiveElapsedSeconds,
        setSyncState: setActiveSyncState,
        setCurrentPosition,
        startRestTimer,
        skipRestTimer,
        setRestDefaultSeconds,
        reset: resetActiveWorkoutState,
    } = useActiveWorkoutActions()

    const workoutId = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId = Number.isFinite(workoutId)

    const {
        data: workout,
        isFetching,
        isError,
        error: queryError,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId, {
        staleWhileEditing: draftWorkoutId === workoutId && isValidWorkoutId,
    })

    const [durationMinutes, setDurationMinutes] = useState(45)
    const [sessionError, setSessionError] = useState<string | null>(null)
    const [addItemKind, setAddItemKind] = useState<AddItemKind | null>(null)
    const [addItemName, setAddItemName] = useState('')
    const [addItemSets, setAddItemSets] = useState('3')
    const [addItemReps, setAddItemReps] = useState('10')
    const [addItemWeight, setAddItemWeight] = useState('')
    const [addItemDuration, setAddItemDuration] = useState('60')
    const [addItemNotes, setAddItemNotes] = useState('')
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState('')
    const [selectedCatalogExercise, setSelectedCatalogExercise] = useState<CatalogExercise | null>(null)
    const [exerciseCatalogFilter, setExerciseCatalogFilter] = useState<ExerciseCatalogFilter>('all')
    const [isFinishSheetOpen, setIsFinishSheetOpen] = useState(false)
    const [finishTagsDraft, setFinishTagsDraft] = useState('')
    const [isAbandonConfirmOpen, setIsAbandonConfirmOpen] = useState(false)
    const [isDeleteExerciseConfirmOpen, setIsDeleteExerciseConfirmOpen] = useState(false)
    const [pendingDeleteExerciseIndex, setPendingDeleteExerciseIndex] = useState<number | null>(null)

    const isActiveDraft =
        workout != null &&
        draftWorkoutId === workout.id &&
        (workout.duration == null || workout.duration <= 0)

    const { isConfirmOpen: isLeaveConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({
        isDirty: isActiveDraft,
    })

    const { patchItem, updateSet, updateSessionFields } = useOptimisticWorkoutSession(workoutId, Boolean(isActiveDraft))

    const completeMutation = useCompleteWorkoutMutation()
    const updateSessionMutation = useUpdateWorkoutSessionMutation()
    const { data: historyData } = useWorkoutHistoryQuery()
    const { data: catalogExercises = [], isLoading: isCatalogLoading } = useExercisesCatalogQuery()

    const { flushNow: flushWorkoutSync, syncState } = useActiveWorkoutSync({
        workoutId,
        workout,
        draftWorkoutId,
        isActiveDraft,
        activeExercises,
        startedAt,
        queryClient,
        initializeActiveSession,
        setActiveExercises,
        setCurrentPosition,
        setActiveElapsedSeconds,
        setActiveSyncState,
        clearWorkoutSessionDraft,
        updateSessionMutation,
        buildSyncPayload,
    })

    const {
        currentExercise,
        currentSet,
        normalizedCurrentSetIndex,
        remainingSets,
        hasNextSet,
        hasPrevSet,
        hasNextExercise,
        hasPrevExercise,
        goToPreviousPosition,
        goToNextSet,
        goToNextExercise,
        handleSkipCurrentSet,
    } = useWorkoutNavigation({
        activeExercises,
        currentExerciseIndex,
        currentSetIndex,
        setCurrentPosition,
        updateSet,
    })

    const {
        structureEditor,
        setStructureEditor,
        openStructureEditor,
        closeStructureEditor,
        handleSaveStructure,
    } = useWorkoutStructureEditor({
        exercises: workout?.exercises ?? [],
        patchItem,
    })

    useEffect(() => {
        setSessionError(null)
        setDurationMinutes(45)
    }, [workoutId])

    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => navigate('/workouts'))
        }
        return () => {
            hideBackButton()
        }
    }, [tg, navigate])

    const errorMessage = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(queryError)
            : null

    const isLoading = isValidWorkoutId && isFetching

    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)

    const exerciseCount = useMemo(() => workout?.exercises.length ?? 0, [workout])

    const completedSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => (
            acc + exercise.sets_completed.filter((set) => set.completed).length
        ), 0)
    }, [workout])

    const completedExercises = useMemo(() => {
        if (!workout) return []
        return workout.exercises.filter((exercise) =>
            exercise.sets_completed.some((set) => set.completed),
        )
    }, [workout])

    const repeatSource = useMemo(() => {
        if (!workout) return null
        const title = workout.comments?.trim() ?? ''
        if (!title) return null
        const items = historyData?.items ?? []
        return items.find((item) => item.id !== workout.id && item.comments?.trim() === title) ?? null
    }, [historyData, workout])

    const previousBestByExercise = useMemo(() => {
        const items = historyData?.items ?? []
        const result = new Map<string, CompletedSet>()

        items
            .filter((item) => item.id !== workout?.id)
            .forEach((item) => {
                item.exercises.forEach((exercise) => {
                    exercise.sets_completed.forEach((set) => {
                        const current = result.get(exercise.name)
                        if (!current) {
                            result.set(exercise.name, set)
                            return
                        }

                        const nextWeight = set.weight ?? 0
                        const currentWeight = current.weight ?? 0
                        const nextReps = set.reps ?? 0
                        const currentReps = current.reps ?? 0
                        const nextDuration = set.duration ?? 0
                        const currentDuration = current.duration ?? 0
                        const nextDistance = set.distance ?? 0
                        const currentDistance = current.distance ?? 0

                        const isBetter =
                            nextWeight > currentWeight ||
                            (nextWeight === currentWeight && nextReps > currentReps) ||
                            (nextWeight === currentWeight && nextReps === currentReps && nextDuration > currentDuration) ||
                            (nextWeight === currentWeight &&
                                nextReps === currentReps &&
                                nextDuration === currentDuration &&
                                nextDistance > currentDistance)

                        if (isBetter) {
                            result.set(exercise.name, set)
                        }
                    })
                })
            })

        return result
    }, [historyData, workout?.id])

    const currentContextCard = useMemo(() => {
        const fallback = {
            exerciseName: 'Подготовка тренировки',
            previousBest: 'Нет данных',
            currentSetLabel: '—',
            remainingSets: 0,
        }

        if (!currentExercise || !currentSet) return fallback

        const bestSet = previousBestByExercise.get(currentExercise.name)
        const bestParts = [
            bestSet?.weight != null ? `${bestSet.weight} кг` : null,
            bestSet?.reps != null ? `${bestSet.reps} повт` : null,
            bestSet?.duration != null ? `${bestSet.duration} сек` : null,
            bestSet?.distance != null ? `${bestSet.distance} км` : null,
        ].filter((part): part is string => Boolean(part))

        const currentParts = [
            currentSet.weight != null ? `${currentSet.weight} кг` : null,
            currentSet.reps != null ? `${currentSet.reps} повт` : null,
            currentSet.duration != null ? `${currentSet.duration} сек` : null,
            currentSet.distance != null ? `${currentSet.distance} км` : null,
        ].filter((part): part is string => Boolean(part))

        return {
            exerciseName: currentExercise.name,
            previousBest: bestParts.length > 0 ? bestParts.join(' • ') : 'Нет данных',
            currentSetLabel: `Подход ${normalizedCurrentSetIndex + 1}/${currentExercise.sets_completed.length}${currentParts.length > 0 ? ` • ${currentParts.join(' • ')}` : ''}`,
            remainingSets,
        }
    }, [
        currentExercise,
        currentSet,
        normalizedCurrentSetIndex,
        previousBestByExercise,
        remainingSets,
    ])

    const filteredCatalogExercises = useMemo(() => {
        const query = exerciseSearchQuery.trim().toLowerCase()
        return catalogExercises.filter((exercise) => {
            const matchesCategory = exerciseCatalogFilter === 'all' || exercise.category === exerciseCatalogFilter
            if (!matchesCategory) return false
            if (!query) return true
            return (
                exercise.name.toLowerCase().includes(query) ||
                exercise.primaryMuscles.some((muscle) => muscle.toLowerCase().includes(query)) ||
                exercise.secondaryMuscles.some((muscle) => muscle.toLowerCase().includes(query))
            )
        })
    }, [catalogExercises, exerciseCatalogFilter, exerciseSearchQuery])

    const favoriteCatalogExercises = useMemo(() => {
        const counts = new Map<string, number>()
        for (const item of historyData?.items ?? []) {
            for (const exercise of item.exercises) {
                const key = exercise.name.trim().toLowerCase()
                if (!key) continue
                counts.set(key, (counts.get(key) ?? 0) + 1)
            }
        }

        return [...catalogExercises]
            .sort((a, b) => (
                (counts.get(b.name.trim().toLowerCase()) ?? 0) - (counts.get(a.name.trim().toLowerCase()) ?? 0)
            ))
            .filter((exercise) => (counts.get(exercise.name.trim().toLowerCase()) ?? 0) > 1)
            .slice(0, 6)
    }, [catalogExercises, historyData?.items])

    const recentCatalogExercises = useMemo(() => {
        const recentNames = new Set<string>()
        const items = historyData?.items ?? []

        for (const item of items.slice(0, 5)) {
            for (const exercise of item.exercises) {
                if (recentNames.size >= 8) break
                const key = exercise.name.trim().toLowerCase()
                if (key) recentNames.add(key)
            }
        }

        if (recentNames.size === 0) return [] as CatalogExercise[]

        return catalogExercises
            .filter((exercise) => recentNames.has(exercise.name.trim().toLowerCase()))
            .slice(0, 6)
    }, [catalogExercises, historyData?.items])

    const suggestedCatalogExercises = useMemo(() => {
        const title = workout?.comments?.toLowerCase() ?? ''
        const preferredCategories: ExerciseCatalogFilter[] = title.includes('кардио')
            ? ['cardio']
            : title.includes('йога') || title.includes('мобил')
                ? ['flexibility']
                : title.includes('функц')
                    ? ['strength', 'cardio']
                    : ['strength']

        return catalogExercises
            .filter((exercise) => preferredCategories.includes((exercise.category as ExerciseCatalogFilter) ?? 'all'))
            .slice(0, 6)
    }, [catalogExercises, workout?.comments])

    const resetAddItemForm = (kind: AddItemKind) => {
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
    }

    const closeAddItemModal = () => {
        setAddItemKind(null)
    }

    const nextExerciseId = (exercises: CompletedExercise[]): number => (
        exercises.reduce((maxId, exercise) => Math.max(maxId, exercise.exercise_id), 1000) + 1
    )

    const handleCreateItem = () => {
        const current = queryClient.getQueryData<WorkoutHistoryItem>(detailQueryKey)
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
    }

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

    const getPreviousSetValues = (exercise: CompletedExercise, setNumber: number): Partial<CompletedSet> => {
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
    }

    const handleCopyPreviousSet = (exerciseIndex: number, setNumber: number) => {
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
    }

    const handleAdjustWeight = (exerciseIndex: number, setNumber: number, delta: number) => {
        const exercise = workout?.exercises[exerciseIndex]
        const targetSet = exercise?.sets_completed.find((item) => item.set_number === setNumber)
        const currentWeight = targetSet?.weight ?? 0
        const nextWeight = Math.max(0, Number((currentWeight + delta).toFixed(2)))
        updateSet(exerciseIndex, setNumber, { weight: nextWeight })
    }

    const handleRepeatPrevious = () => {
        if (!repeatSource) return
        tg.hapticFeedback({ type: 'selection' })
        patchItem((prev) => ({
            ...prev,
            comments: repeatSource.comments,
            tags: repeatSource.tags ?? prev.tags,
            exercises: buildRepeatExercises(repeatSource.exercises),
        }))
    }

    const handleAbandonDraft = () => {
        setSessionError(null)
        setIsAbandonConfirmOpen(true)
    }

    const handleConfirmAbandonDraft = () => {
        setIsAbandonConfirmOpen(false)
        setIsFinishSheetOpen(false)
        setAddItemKind(null)
        closeStructureEditor()
        skipRestTimer()
        resetActiveWorkoutState()
        abandonWorkoutSessionDraft()
        queryClient.removeQueries({ queryKey: detailQueryKey, exact: true })
        void queryClient.invalidateQueries({ queryKey: ['workouts'] })
        toast.info('Тренировка отменена')
        navigate('/workouts', { replace: true })
    }

    const handleDeleteExerciseRequest = (exerciseIndex: number) => {
        setPendingDeleteExerciseIndex(exerciseIndex)
        setIsDeleteExerciseConfirmOpen(true)
    }

    const handleConfirmDeleteExercise = () => {
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
        toast.info('Упражнение удалено')
    }

    const handleCompleteSession = (tagsOverride?: string[]) => {
        setSessionError(null)
        const current = queryClient.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
        if (!current) {
            setSessionError('Нет данных тренировки')
            return
        }

        if (durationMinutes < 1 || durationMinutes > 1440) {
            setSessionError('Укажите длительность от 1 до 1440 минут')
            return
        }

        if (current.exercises.length === 0) {
            setSessionError('Добавьте упражнения (например, начните тренировку с сохранённого шаблона)')
            return
        }

        const hasCompletedSet = current.exercises.some((ex) => ex.sets_completed.some((set) => set.completed))
        if (!hasCompletedSet) {
            setSessionError('Отметьте хотя бы один выполненный подход')
            return
        }

        const payload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: current.exercises,
            comments: current.comments,
            tags: tagsOverride ?? current.tags ?? [],
            glucose_before: current.glucose_before,
            glucose_after: current.glucose_after,
        }

        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        completeMutation.mutate(
            { workoutId, payload },
            {
                onSuccess: (data) => {
                    setIsFinishSheetOpen(false)
                    toast.success('Тренировка успешно завершена')
                    navigate(`/workouts/${data.id}`)
                },
                onError: (error) => {
                    const message = getErrorMessage(error)
                    setSessionError(message)
                    toast.error(message)
                },
            },
        )
    }

    const handleOpenFinishSheet = () => {
        if (!workout) return
        // Flush any pending debounced changes before the user confirms finish.
        flushWorkoutSync()
        setSessionError(null)
        setFinishTagsDraft((workout.tags ?? []).join(', '))
        setIsFinishSheetOpen(true)
    }

    const handleConfirmFinishFromSheet = () => {
        const parsedTags = parseTagsInput(finishTagsDraft)
        updateSessionFields({ tags: parsedTags })
        handleCompleteSession(parsedTags)
    }

    const handleToggleSetCompleted = useCallback((exerciseIndex: number, setNumber: number, nextCompleted: boolean) => {
        tg.hapticFeedback({ type: 'selection' })
        setCurrentPosition(exerciseIndex, setNumber - 1)
        updateSet(exerciseIndex, setNumber, { completed: nextCompleted })
        if (nextCompleted) {
            startRestTimer(restDefaultSeconds)
        }
    }, [restDefaultSeconds, setCurrentPosition, startRestTimer, tg, updateSet])

    const handleExerciseNotesChange = useCallback((exerciseIndex: number, notes: string | undefined) => {
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item, index) => (
                index === exerciseIndex ? { ...item, notes } : item
            )),
        }))
    }, [patchItem])

    if (!isLoading && !errorMessage && workout && !isActiveDraft) {
        return (
            <div className="p-4 space-y-4">
                <ActiveWorkoutHeader onBack={() => navigate('/workouts')} />

                <div className="rounded-xl border border-border bg-telegram-secondary-bg p-4 space-y-3">
                    <p className="text-sm text-telegram-hint">
                        Сессия уже завершена. Экран активной тренировки доступен только во время выполнения подходов.
                    </p>
                    <Button type="button" onClick={() => navigate(`/workouts/${workout.id}`)}>
                        Открыть детали тренировки
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            <UnsavedChangesModal
                isOpen={isLeaveConfirmOpen}
                onLeave={onLeave}
                onStay={onStay}
            />

            <ActiveWorkoutHeader
                onBack={() => guardedAction(() => navigate('/workouts'))}
                syncState={syncState}
            />

            {isLoading && <div className="text-sm text-telegram-hint">Загрузка...</div>}
            {!isLoading && errorMessage && <div className="text-sm text-danger">{errorMessage}</div>}

            {!isLoading && !errorMessage && workout && (
                <>
                    {isActiveDraft && (
                        <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 space-y-3">
                            <p className="text-sm text-telegram-text">
                                Тренировка ещё не завершена. Изменения в упражнениях сохраняются автоматически и
                                отправляются в базу данных до завершения сессии.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<Plus className="h-4 w-4" />}
                                    onClick={() => resetAddItemForm('exercise')}
                                >
                                    Добавить упражнение
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<Timer className="h-4 w-4" />}
                                    onClick={() => resetAddItemForm('timer')}
                                >
                                    Добавить таймер
                                </Button>
                                {repeatSource && (
                                    <Button type="button" variant="secondary" size="sm" onClick={handleRepeatPrevious}>
                                        Повторить прошлую
                                    </Button>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full border-danger/35 text-danger hover:bg-danger/10"
                                onClick={handleAbandonDraft}
                            >
                                Отменить тренировку
                            </Button>
                        </div>
                    )}

                    <SessionSummaryCard
                        workout={workout}
                        isActiveDraft={isActiveDraft}
                        durationMinutes={durationMinutes}
                        exerciseCount={exerciseCount}
                        completedSetCount={completedSetCount}
                        onDurationChange={setDurationMinutes}
                        onCommentsChange={(value) => updateSessionFields({ comments: value || undefined })}
                    />

                    {sessionError && <p className="text-sm text-danger">{sessionError}</p>}
                    {completeMutation.isError && (
                        <p className="text-sm text-danger">{getErrorMessage(completeMutation.error)}</p>
                    )}
                    {updateSessionMutation.isError && (
                        <p className="text-sm text-danger">{getErrorMessage(updateSessionMutation.error)}</p>
                    )}

                    <RestTimerPanel />

                    <CurrentExerciseCard
                        exerciseName={currentContextCard.exerciseName}
                        previousBest={currentContextCard.previousBest}
                        currentSet={currentContextCard.currentSetLabel}
                        remainingSets={currentContextCard.remainingSets}
                        syncState={syncState}
                    />

                    <SessionNavigationPanel
                        hasPrev={hasPrevSet || hasPrevExercise}
                        hasNextSet={hasNextSet}
                        hasNextExercise={hasNextExercise}
                        onBack={goToPreviousPosition}
                        onNextSet={goToNextSet}
                        onNextExercise={goToNextExercise}
                        onSkip={handleSkipCurrentSet}
                    />

                    <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
                        <p className="text-xs text-telegram-hint">Отдых по умолчанию после подхода</p>
                        <div className="flex flex-wrap gap-1.5">
                            {REST_PRESETS_SECONDS.map((seconds) => (
                                <button
                                    key={seconds}
                                    type="button"
                                    onClick={() => setRestDefaultSeconds(seconds)}
                                    className={`rounded-full px-2 py-1 text-[11px] transition-colors ${
                                        restDefaultSeconds === seconds
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-telegram-bg text-telegram-hint'
                                    }`}
                                >
                                    {seconds < 60 ? `${seconds}с` : `${Math.floor(seconds / 60)}м`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button type="button" className="w-full" data-testid="finish-workout-btn" disabled={completeMutation.isPending} onClick={handleOpenFinishSheet}>
                        Завершить тренировку
                    </Button>

                    <ActiveExerciseList
                        exercises={workout.exercises}
                        canReorder={isActiveDraft}
                        onDragEnd={handleDragEnd}
                        onOpenStructureEditor={openStructureEditor}
                        onDeleteExercise={handleDeleteExerciseRequest}
                        onSetCurrentPosition={setCurrentPosition}
                        onToggleSetCompleted={handleToggleSetCompleted}
                        onCopyPreviousSet={handleCopyPreviousSet}
                        onAdjustWeight={handleAdjustWeight}
                        onUpdateSet={updateSet}
                        onNotesChange={handleExerciseNotesChange}
                    />

                    {isFinishSheetOpen && (
                        <FinishWorkoutModal
                            isOpen={isFinishSheetOpen}
                            durationMinutes={durationMinutes}
                            completedExercises={completedExercises}
                            comment={workout.comments ?? ''}
                            tagsDraft={finishTagsDraft}
                            isPending={completeMutation.isPending}
                            errorMessage={sessionError ?? (completeMutation.isError ? getErrorMessage(completeMutation.error) : null)}
                            onClose={() => setIsFinishSheetOpen(false)}
                            onConfirm={handleConfirmFinishFromSheet}
                            onChangeTagsDraft={setFinishTagsDraft}
                        />
                    )}

                    {isAbandonConfirmOpen && (
                        <AbandonWorkoutConfirmModal
                            isOpen={isAbandonConfirmOpen}
                            onClose={() => setIsAbandonConfirmOpen(false)}
                            onConfirm={handleConfirmAbandonDraft}
                        />
                    )}
                    <WorkoutConfirmModal
                        isOpen={isDeleteExerciseConfirmOpen}
                        onClose={() => {
                            setIsDeleteExerciseConfirmOpen(false)
                            setPendingDeleteExerciseIndex(null)
                        }}
                        onConfirm={handleConfirmDeleteExercise}
                        title="Удалить упражнение?"
                        description="Упражнение будет удалено из текущей тренировки."
                        cancelLabel="Остаться"
                        confirmLabel="Удалить"
                        confirmVariant="emergency"
                    />
                    {addItemKind === 'exercise' && (
                        <AddExerciseModal
                            isOpen
                            isCatalogLoading={isCatalogLoading}
                            catalogFilter={exerciseCatalogFilter}
                            searchQuery={exerciseSearchQuery}
                            selectedExercise={selectedCatalogExercise}
                            filteredCatalogExercises={filteredCatalogExercises}
                            recentExercises={recentCatalogExercises}
                            favoriteExercises={favoriteCatalogExercises}
                            suggestedExercises={suggestedCatalogExercises}
                            sets={addItemSets}
                            reps={addItemReps}
                            weight={addItemWeight}
                            duration={addItemDuration}
                            notes={addItemNotes}
                            onClose={closeAddItemModal}
                            onChangeFilter={setExerciseCatalogFilter}
                            onChangeSearch={setExerciseSearchQuery}
                            onSelectExercise={setSelectedCatalogExercise}
                            onChangeSets={setAddItemSets}
                            onChangeReps={setAddItemReps}
                            onChangeWeight={setAddItemWeight}
                            onChangeDuration={setAddItemDuration}
                            onChangeNotes={setAddItemNotes}
                            onSubmit={handleCreateItem}
                        />
                    )}

                    {addItemKind === 'timer' && (
                        <AddTimerModal
                            isOpen
                            name={addItemName}
                            duration={addItemDuration}
                            notes={addItemNotes}
                            onClose={closeAddItemModal}
                            onChangeName={setAddItemName}
                            onChangeDuration={setAddItemDuration}
                            onChangeNotes={setAddItemNotes}
                            onSubmit={handleCreateItem}
                        />
                    )}

                    {structureEditor != null && (
                        <ExerciseStructureEditorModal
                            isOpen
                            editorState={structureEditor}
                            onClose={closeStructureEditor}
                            onChange={setStructureEditor}
                            onSave={handleSaveStructure}
                        />
                    )}
                </>
            )}
        </div>
    )
}
