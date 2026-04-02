import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useActiveWorkoutStore, useWorkoutSessionDraftStore } from '@/state/local'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    Pause,
    PencilRuler,
    Play,
    Plus,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Search,
    SkipForward,
    Timer,
    Trash2,
} from 'lucide-react'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import {
    useCompleteWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { getErrorMessage } from '@shared/errors'
import { queryKeys } from '@shared/api/queryKeys'
import { Modal } from '@shared/ui/Modal'
import { Chip, ChipGroup } from '@shared/ui/Chip'
import { Input } from '@shared/ui/Input'
import {
    formatDate,
    formatDurationMinutes,
    parseOptionalNumber,
    getExerciseSummaryMeta,
    formatExerciseStructureSummary,
} from '@features/workouts/lib/workoutDetailFormatters'
import { buildRepeatExercises } from '@features/workouts/lib/workoutModeHelpers'
import { SortableExerciseCard } from '@features/workouts/components/SortableExerciseCard'
import { CurrentExerciseCard } from '@features/workouts/components'
import { FinishWorkoutSheet } from '@features/workouts/components'
import type { ActiveWorkoutSyncState } from '@/state/local'
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

type StructureEditorState = {
    exerciseIndex: number
    sets: string
    reps: string
    weight: string
    duration: string
} | null

function parseTagsInput(value: string): string[] {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
}

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const RIR_OPTIONS = [0, 1, 2, 3, 4]
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
    const initializeActiveSession = useActiveWorkoutStore((s) => s.initializeSession)
    const setActiveExercises = useActiveWorkoutStore((s) => s.setExercises)
    const setActiveElapsedSeconds = useActiveWorkoutStore((s) => s.setElapsedSeconds)
    const setActiveSyncState = useActiveWorkoutStore((s) => s.setSyncState)
    const setCurrentPosition = useActiveWorkoutStore((s) => s.setCurrentPosition)
    const activeExercises = useActiveWorkoutStore((s) => s.exercises)
    const currentExerciseIndex = useActiveWorkoutStore((s) => s.currentExerciseIndex)
    const currentSetIndex = useActiveWorkoutStore((s) => s.currentSetIndex)
    const syncState = useActiveWorkoutStore((s) => s.syncState)
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const startRestTimer = useActiveWorkoutStore((s) => s.startRestTimer)
    const tickRestTimer = useActiveWorkoutStore((s) => s.tickRestTimer)
    const pauseRestTimer = useActiveWorkoutStore((s) => s.pauseRestTimer)
    const resumeRestTimer = useActiveWorkoutStore((s) => s.resumeRestTimer)
    const restartRestTimer = useActiveWorkoutStore((s) => s.restartRestTimer)
    const skipRestTimer = useActiveWorkoutStore((s) => s.skipRestTimer)
    const setRestDefaultSeconds = useActiveWorkoutStore((s) => s.setRestDefaultSeconds)
    const resetActiveWorkoutState = useActiveWorkoutStore((s) => s.reset)
    const startedAt = useActiveWorkoutStore((s) => s.startedAt)

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
    const [structureEditor, setStructureEditor] = useState<StructureEditorState>(null)
    const [isFinishSheetOpen, setIsFinishSheetOpen] = useState(false)
    const [finishTagsDraft, setFinishTagsDraft] = useState('')
    const [isAbandonConfirmOpen, setIsAbandonConfirmOpen] = useState(false)

    const isActiveDraft =
        workout != null &&
        draftWorkoutId === workout.id &&
        (workout.duration == null || workout.duration <= 0)

    const { patchItem, updateSet, updateSessionFields } = useOptimisticWorkoutSession(workoutId, Boolean(isActiveDraft))

    const completeMutation = useCompleteWorkoutMutation()
    const updateSessionMutation = useUpdateWorkoutSessionMutation()
    const { data: historyData } = useWorkoutHistoryQuery()
    const { data: catalogExercises = [], isLoading: isCatalogLoading } = useExercisesCatalogQuery()
    const lastPersistedSnapshotRef = useRef<string | null>(null)
    const lastAttemptedSnapshotRef = useRef<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    useEffect(() => {
        if (!workout || workout.id !== draftWorkoutId) return
        const d = workout.duration
        if (typeof d === 'number' && d > 0) clearWorkoutSessionDraft()
    }, [workout, draftWorkoutId, clearWorkoutSessionDraft])

    useEffect(() => {
        if (!workout || !isActiveDraft) return
        const startedAtMs = Date.parse(workout.created_at)
        initializeActiveSession({
            sessionId: workout.id,
            startedAt: Number.isNaN(startedAtMs) ? Date.now() : startedAtMs,
            exercises: workout.exercises,
        })
    }, [initializeActiveSession, isActiveDraft, workout])

    useEffect(() => {
        if (!workout || !isActiveDraft) return
        setActiveExercises(workout.exercises)
    }, [isActiveDraft, setActiveExercises, workout])

    useEffect(() => {
        if (!isActiveDraft || activeExercises.length === 0) return

        const firstIncomplete = activeExercises
            .map((exercise, exerciseIndex) => {
                const setIndex = exercise.sets_completed.findIndex((set) => !set.completed)
                if (setIndex < 0) return null
                return { exerciseIndex, setIndex }
            })
            .find((value): value is { exerciseIndex: number; setIndex: number } => value != null)

        if (firstIncomplete) {
            setCurrentPosition(firstIncomplete.exerciseIndex, firstIncomplete.setIndex)
            return
        }

        const lastExerciseIndex = activeExercises.length - 1
        const lastSetIndex = Math.max(0, activeExercises[lastExerciseIndex].sets_completed.length - 1)
        setCurrentPosition(lastExerciseIndex, lastSetIndex)
    }, [activeExercises, isActiveDraft, setCurrentPosition])

    useEffect(() => {
        if (!isActiveDraft || startedAt == null) return
        setActiveElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        const interval = window.setInterval(() => {
            setActiveElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        }, 1000)
        return () => {
            window.clearInterval(interval)
        }
    }, [isActiveDraft, setActiveElapsedSeconds, startedAt])

    useEffect(() => {
        if (!restTimer.isRunning) return
        const interval = window.setInterval(() => {
            tickRestTimer()
        }, 1000)
        return () => {
            window.clearInterval(interval)
        }
    }, [restTimer.isRunning, tickRestTimer])

    useEffect(() => {
        setSessionError(null)
        setDurationMinutes(45)
        lastPersistedSnapshotRef.current = null
        lastAttemptedSnapshotRef.current = null
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

    const activeSessionPayload = useMemo(
        () => (isActiveDraft && workout ? buildSyncPayload(workout) : null),
        [isActiveDraft, workout],
    )

    const activeSessionSnapshot = useMemo(
        () => (activeSessionPayload ? JSON.stringify(activeSessionPayload) : null),
        [activeSessionPayload],
    )

    const exerciseCount = useMemo(
        () => workout?.exercises.length ?? 0,
        [workout]
    )

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

    const currentExercise = activeExercises[currentExerciseIndex] ?? null
    const normalizedCurrentSetIndex = currentExercise
        ? Math.min(Math.max(currentSetIndex, 0), Math.max(0, currentExercise.sets_completed.length - 1))
        : 0
    const currentSet = currentExercise?.sets_completed[normalizedCurrentSetIndex]
    const remainingSets = currentExercise
        ? Math.max(0, currentExercise.sets_completed.length - (normalizedCurrentSetIndex + 1))
        : 0

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
            syncState,
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
            syncState,
        }
    }, [currentExercise, currentSet, normalizedCurrentSetIndex, previousBestByExercise, remainingSets, syncState])

    const hasNextSet = Boolean(
        currentExercise && normalizedCurrentSetIndex < currentExercise.sets_completed.length - 1,
    )
    const hasPrevSet = Boolean(currentExercise && normalizedCurrentSetIndex > 0)
    const hasNextExercise = currentExerciseIndex < Math.max(0, activeExercises.length - 1)
    const hasPrevExercise = currentExerciseIndex > 0

    const goToPreviousPosition = () => {
        if (hasPrevSet) {
            setCurrentPosition(currentExerciseIndex, normalizedCurrentSetIndex - 1)
            return
        }
        if (hasPrevExercise) {
            const prevExerciseIndex = currentExerciseIndex - 1
            const prevExercise = activeExercises[prevExerciseIndex]
            const prevSetIndex = Math.max(0, prevExercise.sets_completed.length - 1)
            setCurrentPosition(prevExerciseIndex, prevSetIndex)
        }
    }

    const goToNextSet = () => {
        if (hasNextSet) {
            setCurrentPosition(currentExerciseIndex, normalizedCurrentSetIndex + 1)
            return
        }
        if (hasNextExercise) {
            setCurrentPosition(currentExerciseIndex + 1, 0)
        }
    }

    const goToNextExercise = () => {
        if (!hasNextExercise) return
        setCurrentPosition(currentExerciseIndex + 1, 0)
    }

    const handleSkipCurrentSet = () => {
        if (!currentExercise || !currentSet) return
        updateSet(currentExerciseIndex, currentSet.set_number, { completed: false })
        goToNextSet()
    }

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

    const formatRestTime = (seconds: number) => {
        const safeSeconds = Math.max(0, seconds)
        const mins = Math.floor(safeSeconds / 60)
        const secs = safeSeconds % 60
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }

    useEffect(() => {
        if (!isActiveDraft || !activeSessionPayload || !activeSessionSnapshot) return
        if (lastPersistedSnapshotRef.current == null) {
            lastPersistedSnapshotRef.current = activeSessionSnapshot
            lastAttemptedSnapshotRef.current = activeSessionSnapshot
            return
        }
        if (
            lastPersistedSnapshotRef.current === activeSessionSnapshot ||
            lastAttemptedSnapshotRef.current === activeSessionSnapshot
        ) {
            return
        }

        const timeout = window.setTimeout(() => {
            lastAttemptedSnapshotRef.current = activeSessionSnapshot
            setActiveSyncState('syncing')
            updateSessionMutation.mutate(
                { workoutId, payload: activeSessionPayload },
                {
                    onSuccess: (data) => {
                        lastPersistedSnapshotRef.current = activeSessionSnapshot
                        queryClient.setQueryData(detailQueryKey, data)
                        setActiveSyncState('synced')
                    },
                    onError: () => {
                        setActiveSyncState('error')
                    },
                },
            )
        }, 500)

        return () => {
            window.clearTimeout(timeout)
        }
    }, [
        activeSessionPayload,
        activeSessionSnapshot,
        detailQueryKey,
        isActiveDraft,
        queryClient,
        setActiveSyncState,
        updateSessionMutation,
        workoutId,
    ])

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

    const closeStructureEditor = () => {
        setStructureEditor(null)
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

    const handleDragEnd = (event: DragEndEvent) => {
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
    }

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

    const openStructureEditor = (exerciseIndex: number) => {
        const current = queryClient.getQueryData<WorkoutHistoryItem>(detailQueryKey)
        const exercise = current?.exercises[exerciseIndex]
        if (!exercise) return
        const firstSet = exercise.sets_completed[0]
        setStructureEditor({
            exerciseIndex,
            sets: String(Math.max(1, exercise.sets_completed.length)),
            reps: firstSet?.reps != null ? String(firstSet.reps) : '',
            weight: firstSet?.weight != null ? String(firstSet.weight) : '',
            duration: firstSet?.duration != null ? String(firstSet.duration) : '',
        })
    }

    const handleSaveStructure = () => {
        if (!structureEditor) return
        const current = queryClient.getQueryData<WorkoutHistoryItem>(detailQueryKey)
        const exercise = current?.exercises[structureEditor.exerciseIndex]
        if (!exercise) return

        const setCount = Math.max(1, Number.parseInt(structureEditor.sets, 10) || 1)
        const reps = parseOptionalNumber(structureEditor.reps)
        const weight = parseOptionalNumber(structureEditor.weight)
        const duration = parseOptionalNumber(structureEditor.duration)

        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item, index) => {
                if (index !== structureEditor.exerciseIndex) return item
                return {
                    ...item,
                    sets_completed: Array.from({ length: setCount }, (_, setIndex) => {
                        const existingSet = item.sets_completed[setIndex]
                        return {
                            set_number: setIndex + 1,
                            completed: existingSet?.completed ?? false,
                            reps,
                            weight,
                            duration,
                            rpe: existingSet?.rpe,
                            rir: existingSet?.rir,
                            distance: existingSet?.distance,
                        }
                    }),
                }
            }),
        }))

        closeStructureEditor()
    }

    const handleDeleteExercise = (exerciseIndex: number) => {
        tg.hapticFeedback({ type: 'impact', style: 'heavy' })
        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((_, index) => index !== exerciseIndex),
        }))
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
        setStructureEditor(null)
        skipRestTimer()
        resetActiveWorkoutState()
        abandonWorkoutSessionDraft()
        queryClient.removeQueries({ queryKey: detailQueryKey, exact: true })
        void queryClient.invalidateQueries({ queryKey: ['workouts'] })
        navigate('/workouts', { replace: true })
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
        const hasCompletedSet = current.exercises.some((ex) =>
            ex.sets_completed.some((s) => s.completed),
        )
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
                    navigate(`/workouts/${data.id}`)
                },
            },
        )
    }

    const handleOpenFinishSheet = () => {
        if (!workout) return
        setSessionError(null)
        setFinishTagsDraft((workout.tags ?? []).join(', '))
        setIsFinishSheetOpen(true)
    }

    const handleConfirmFinishFromSheet = () => {
        const parsedTags = parseTagsInput(finishTagsDraft)
        updateSessionFields({ tags: parsedTags })
        handleCompleteSession(parsedTags)
    }

    if (!isLoading && !errorMessage && workout && !isActiveDraft) {
        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/workouts')}
                        className="w-9 h-9 rounded-full bg-telegram-secondary-bg flex items-center justify-center text-telegram-text"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h1 className="text-xl font-bold text-telegram-text">Активная тренировка</h1>
                </div>

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
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate('/workouts')}
                    className="w-9 h-9 rounded-full bg-telegram-secondary-bg flex items-center justify-center text-telegram-text"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-xl font-bold text-telegram-text">Активная тренировка</h1>
            </div>

            {isLoading && (
                <div className="text-sm text-telegram-hint">Загрузка...</div>
            )}

            {!isLoading && errorMessage && (
                <div className="text-sm text-danger">{errorMessage}</div>
            )}

            {!isLoading && !errorMessage && workout && (
                <>
                    {isActiveDraft && (
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40 p-4 space-y-3">
                            <p className="text-sm text-gray-800 dark:text-amber-100/90">
                                Тренировка ещё не завершена. Изменения в упражнениях сохраняются автоматически и
                                отправляются в базу данных до завершения сессии.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<Plus className="w-4 h-4" />}
                                    onClick={() => resetAddItemForm('exercise')}
                                >
                                    Добавить упражнение
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<Timer className="w-4 h-4" />}
                                    onClick={() => resetAddItemForm('timer')}
                                >
                                    Добавить таймер
                                </Button>
                                {repeatSource && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleRepeatPrevious}
                                    >
                                        Повторить прошлую
                                    </Button>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
                                onClick={handleAbandonDraft}
                            >
                                Отменить тренировку
                            </Button>
                        </div>
                    )}
                    <div className="bg-telegram-secondary-bg rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-telegram-hint">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(workout.date)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="flex items-center gap-1 text-xs text-telegram-hint">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    <span>Длительность</span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">
                                    {formatDurationMinutes(durationMinutes)}
                                </div>
                            </div>
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="text-xs text-telegram-hint">Упражнения</div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">
                                    {exerciseCount}
                                </div>
                            </div>
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="text-xs text-telegram-hint">Подходы</div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">
                                    {completedSetCount}
                                </div>
                            </div>
                        </div>

                        {isActiveDraft && (
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-telegram-hint">
                                    Длительность (мин)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={durationMinutes}
                                    onChange={(e) => {
                                        const v = Number(e.target.value)
                                        if (Number.isFinite(v)) setDurationMinutes(v)
                                    }}
                                    className="w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-telegram-hint">
                                Комментарий (в т.ч. название сессии)
                            </label>
                            <textarea
                                value={workout.comments ?? ''}
                                onChange={(e) => updateSessionFields({ comments: e.target.value || undefined })}
                                rows={2}
                                className="w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                            />
                        </div>
                    </div>

                    {sessionError && (
                        <p className="text-sm text-danger">{sessionError}</p>
                    )}
                    {completeMutation.isError && (
                        <p className="text-sm text-danger">
                            {getErrorMessage(completeMutation.error)}
                        </p>
                    )}
                    {updateSessionMutation.isError && (
                        <p className="text-sm text-danger">
                            {getErrorMessage(updateSessionMutation.error)}
                        </p>
                    )}

                    {(restTimer.isRunning || restTimer.isPaused) && (
                        <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs text-telegram-hint">Отдых</p>
                                    <p className="text-lg font-semibold text-telegram-text">{formatRestTime(restTimer.remainingSeconds)}</p>
                                </div>
                                <span className="text-xs text-telegram-hint">
                                    {restTimer.isPaused ? 'Пауза' : 'Идёт'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {restTimer.isPaused ? (
                                    <Button type="button" variant="secondary" size="sm" leftIcon={<Play className="w-4 h-4" />} onClick={resumeRestTimer}>
                                        Продолжить
                                    </Button>
                                ) : (
                                    <Button type="button" variant="secondary" size="sm" leftIcon={<Pause className="w-4 h-4" />} onClick={pauseRestTimer}>
                                        Пауза
                                    </Button>
                                )}
                                <Button type="button" variant="secondary" size="sm" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={restartRestTimer}>
                                    Restart
                                </Button>
                                <Button type="button" variant="secondary" size="sm" leftIcon={<SkipForward className="w-4 h-4" />} onClick={skipRestTimer}>
                                    Skip
                                </Button>
                            </div>
                        </div>
                    )}

                    <CurrentExerciseCard
                        exerciseName={currentContextCard.exerciseName}
                        previousBest={currentContextCard.previousBest}
                        currentSet={currentContextCard.currentSetLabel}
                        remainingSets={currentContextCard.remainingSets}
                        syncState={currentContextCard.syncState as ActiveWorkoutSyncState}
                    />

                    <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
                        <p className="text-xs text-telegram-hint">Навигация по сессии</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                leftIcon={<ChevronLeft className="w-4 h-4" />}
                                disabled={!hasPrevSet && !hasPrevExercise}
                                onClick={goToPreviousPosition}
                            >
                                Назад
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                leftIcon={<ChevronRight className="w-4 h-4" />}
                                disabled={!hasNextSet && !hasNextExercise}
                                onClick={goToNextSet}
                            >
                                Следующий подход
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                leftIcon={<SkipForward className="w-4 h-4" />}
                                disabled={!hasNextExercise}
                                onClick={goToNextExercise}
                            >
                                Следующее упражнение
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                leftIcon={<SkipForward className="w-4 h-4" />}
                                disabled={!hasNextSet && !hasNextExercise}
                                onClick={handleSkipCurrentSet}
                            >
                                Пропустить
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
                        <p className="text-xs text-telegram-hint">Отдых по умолчанию после подхода</p>
                        <div className="flex flex-wrap gap-1.5">
                            {REST_PRESETS_SECONDS.map((seconds) => (
                                <button
                                    key={seconds}
                                    type="button"
                                    onClick={() => setRestDefaultSeconds(seconds)}
                                    className={`rounded-full px-2 py-1 text-[11px] transition-colors ${restDefaultSeconds === seconds
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-telegram-bg text-telegram-hint'
                                        }`}
                                >
                                    {seconds < 60 ? `${seconds}с` : `${Math.floor(seconds / 60)}м`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button
                        type="button"
                        className="w-full"
                        disabled={completeMutation.isPending}
                        onClick={handleOpenFinishSheet}
                    >
                        Завершить тренировку
                    </Button>

                    <div className="space-y-3">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={workout.exercises.map((exercise, index) => `${exercise.exercise_id}-${index}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                {workout.exercises.map((exercise, exerciseIndex) => {
                                    const summaryMeta = getExerciseSummaryMeta(exercise)
                                    const SummaryIcon = summaryMeta.icon
                                    return (
                                    <SortableExerciseCard
                                        key={`${exercise.exercise_id}-${exerciseIndex}`}
                                        id={`${exercise.exercise_id}-${exerciseIndex}`}
                                        isActive
                                    >
                                        <div className={`bg-telegram-secondary-bg rounded-xl p-4 ${summaryMeta.borderClass}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-semibold text-telegram-text">{exercise.name}</h2>
                                        <div className="mt-1 space-y-1">
                                            <div
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${summaryMeta.className}`}
                                                title={summaryMeta.reason}
                                            >
                                                <SummaryIcon className="h-3.5 w-3.5" />
                                                <span>{summaryMeta.label}</span>
                                                <span className="opacity-70">•</span>
                                                <span>{formatExerciseStructureSummary(exercise)}</span>
                                            </div>
                                            <p className="text-[11px] leading-4 text-telegram-hint sm:hidden">
                                                {summaryMeta.mobileReason}
                                            </p>
                                            <p className="hidden text-[11px] leading-4 text-telegram-hint sm:block">
                                                {summaryMeta.reason}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openStructureEditor(exerciseIndex)}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint"
                                            aria-label="Изменить структуру упражнения"
                                        >
                                            <PencilRuler className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteExercise(exerciseIndex)}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-danger"
                                            aria-label="Удалить упражнение"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            #{exercise.exercise_id}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-2 space-y-2">
                                    {exercise.sets_completed.map((set) => (
                                        <div
                                            key={set.set_number}
                                            className="rounded-lg bg-telegram-bg/60 p-2 text-sm text-telegram-text"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">Подход {set.set_number}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        tg.hapticFeedback({ type: 'selection' })
                                                        setCurrentPosition(exerciseIndex, set.set_number - 1)
                                                        const nextCompleted = !set.completed
                                                        updateSet(exerciseIndex, set.set_number, {
                                                            completed: nextCompleted,
                                                        })
                                                        if (nextCompleted) {
                                                            startRestTimer(restDefaultSeconds)
                                                        }
                                                    }}
                                                    className={`px-2 py-0.5 rounded-full text-xs transition-colors ${set.completed
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                        : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                        }`}
                                                >
                                                    {set.completed ? 'Выполнен' : 'Отметить'}
                                                </button>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyPreviousSet(exerciseIndex, set.set_number)}
                                                    className="rounded-md bg-telegram-bg px-2 py-1 text-[11px] text-telegram-hint"
                                                >
                                                    Копировать с прошлого
                                                </button>
                                                {[1.25, 2.5, 5].map((delta) => (
                                                    <button
                                                        key={delta}
                                                        type="button"
                                                        onClick={() => handleAdjustWeight(exerciseIndex, set.set_number, delta)}
                                                        className="rounded-md bg-telegram-bg px-2 py-1 text-[11px] text-telegram-hint"
                                                    >
                                                        +{delta}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                                                <label className="text-xs text-telegram-hint">
                                                    Повторы
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={set.reps ?? ''}
                                                        onFocus={() => setCurrentPosition(exerciseIndex, set.set_number - 1)}
                                                        onChange={(e) =>
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                reps: parseOptionalNumber(e.target.value),
                                                            })
                                                        }
                                                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                                                    />
                                                </label>
                                                <label className="text-xs text-telegram-hint">
                                                    Вес (кг)
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.5"
                                                        value={set.weight ?? ''}
                                                        onFocus={() => setCurrentPosition(exerciseIndex, set.set_number - 1)}
                                                        onChange={(e) =>
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                weight: parseOptionalNumber(e.target.value),
                                                            })
                                                        }
                                                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                                                    />
                                                </label>
                                                <label className="text-xs text-telegram-hint">
                                                    Длительность (сек)
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={set.duration ?? ''}
                                                        onFocus={() => setCurrentPosition(exerciseIndex, set.set_number - 1)}
                                                        onChange={(e) =>
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                duration: parseOptionalNumber(e.target.value),
                                                            })
                                                        }
                                                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                                                    />
                                                </label>
                                                <label className="text-xs text-telegram-hint">
                                                    Дистанция (км)
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={set.distance ?? ''}
                                                        onFocus={() => setCurrentPosition(exerciseIndex, set.set_number - 1)}
                                                        onChange={(e) =>
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                distance: parseOptionalNumber(e.target.value),
                                                            })
                                                        }
                                                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                                                    />
                                                </label>
                                            </div>
                                            <div className="mt-2 space-y-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[11px] text-telegram-hint">RPE</span>
                                                    {RPE_OPTIONS.map((value) => (
                                                        <button
                                                            key={`rpe-${value}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setCurrentPosition(exerciseIndex, set.set_number - 1)
                                                                updateSet(exerciseIndex, set.set_number, {
                                                                    rpe: set.rpe === value ? undefined : value,
                                                                })
                                                            }}
                                                            className={`rounded-full px-2 py-1 text-[11px] transition-colors ${set.rpe === value
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-telegram-bg text-telegram-hint'
                                                                }`}
                                                        >
                                                            {value}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[11px] text-telegram-hint">RIR</span>
                                                    {RIR_OPTIONS.map((value) => (
                                                        <button
                                                            key={`rir-${value}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setCurrentPosition(exerciseIndex, set.set_number - 1)
                                                                updateSet(exerciseIndex, set.set_number, {
                                                                    rir: set.rir === value ? undefined : value,
                                                                })
                                                            }}
                                                            className={`rounded-full px-2 py-1 text-[11px] transition-colors ${set.rir === value
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-telegram-bg text-telegram-hint'
                                                                }`}
                                                        >
                                                            {value}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-telegram-hint">
                                        Заметки к упражнению
                                    </label>
                                    <textarea
                                        value={exercise.notes ?? ''}
                                        onChange={(e) => {
                                            const nextNotes = e.target.value || undefined
                                            patchItem((prev) => ({
                                                ...prev,
                                                exercises: prev.exercises.map((item, index) => (
                                                    index === exerciseIndex ? { ...item, notes: nextNotes } : item
                                                )),
                                            }))
                                        }}
                                        rows={2}
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    />
                                </div>
                                        </div>
                                    </SortableExerciseCard>
                                    )
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>

                    <FinishWorkoutSheet
                        isOpen={isFinishSheetOpen}
                        onClose={() => setIsFinishSheetOpen(false)}
                        onConfirm={handleConfirmFinishFromSheet}
                        durationLabel={formatDurationMinutes(durationMinutes)}
                        completedExercises={completedExercises}
                        comment={workout.comments ?? ''}
                        tagsDraft={finishTagsDraft}
                        onChangeTagsDraft={setFinishTagsDraft}
                        isPending={completeMutation.isPending}
                        errorMessage={sessionError ?? (completeMutation.isError ? getErrorMessage(completeMutation.error) : null)}
                    />

                    <Modal
                        isOpen={isAbandonConfirmOpen}
                        onClose={() => setIsAbandonConfirmOpen(false)}
                        title="Отменить тренировку?"
                        size="sm"
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-telegram-text">
                                Текущая сессия будет отменена локально: черновик и активное состояние очистятся.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="secondary" fullWidth onClick={() => setIsAbandonConfirmOpen(false)}>
                                    Продолжить тренировку
                                </Button>
                                <Button variant="emergency" fullWidth onClick={handleConfirmAbandonDraft}>
                                    Подтвердить отмену
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    <Modal
                        isOpen={addItemKind != null}
                        onClose={closeAddItemModal}
                        title={addItemKind === 'timer' ? 'Добавить таймер' : 'Добавить упражнение'}
                        size="md"
                    >
                        <div className="space-y-4">
                            {addItemKind === 'exercise' ? (
                                <div className="space-y-3">
                                    <ChipGroup wrap gap="sm">
                                        {[
                                            { id: 'all', label: 'Все' },
                                            { id: 'strength', label: 'Силовые' },
                                            { id: 'cardio', label: 'Кардио' },
                                            { id: 'flexibility', label: 'Гибкость' },
                                        ].map((filter) => (
                                            <Chip
                                                key={filter.id}
                                                label={filter.label}
                                                active={exerciseCatalogFilter === filter.id}
                                                onClick={() => setExerciseCatalogFilter(filter.id as ExerciseCatalogFilter)}
                                                size="sm"
                                                variant="outlined"
                                            />
                                        ))}
                                    </ChipGroup>
                                    <Input
                                        type="search"
                                        value={exerciseSearchQuery}
                                        onChange={(e) => setExerciseSearchQuery(e.target.value)}
                                        leftIcon={<Search className="w-4 h-4" />}
                                        placeholder="Поиск по каталогу упражнений"
                                    />
                                    <div className="max-h-64 space-y-2 overflow-y-auto">
                                        {isCatalogLoading && (
                                            <p className="text-sm text-telegram-hint">Загрузка каталога...</p>
                                        )}
                                        {!isCatalogLoading && filteredCatalogExercises.length === 0 && (
                                            <p className="text-sm text-telegram-hint">Ничего не найдено</p>
                                        )}
                                        {filteredCatalogExercises.map((exercise) => {
                                            const isSelected = selectedCatalogExercise?.id === exercise.id
                                            return (
                                                <button
                                                    key={exercise.id}
                                                    type="button"
                                                    onClick={() => setSelectedCatalogExercise(exercise)}
                                                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border bg-telegram-secondary-bg text-telegram-text'
                                                    }`}
                                                >
                                                    <div className="font-medium">{exercise.name}</div>
                                                    <div className="mt-1 text-xs opacity-80">
                                                        {exercise.primaryMuscles.join(', ') || exercise.category}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <label className="block text-sm font-medium text-telegram-text">
                                    Название
                                    <input
                                        type="text"
                                        value={addItemName}
                                        onChange={(e) => setAddItemName(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                        placeholder="Например, Таймер отдыха"
                                    />
                                </label>
                            )}

                            {addItemKind !== 'timer' && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <label className="text-sm font-medium text-telegram-text">
                                        Подходы
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={addItemSets}
                                            onChange={(e) => setAddItemSets(e.target.value)}
                                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-telegram-text">
                                        Повторы
                                        <input
                                            type="number"
                                            min={0}
                                            value={addItemReps}
                                            onChange={(e) => setAddItemReps(e.target.value)}
                                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-telegram-text">
                                        Вес (кг)
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.5"
                                            value={addItemWeight}
                                            onChange={(e) => setAddItemWeight(e.target.value)}
                                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                        />
                                    </label>
                                </div>
                            )}

                            <label className="block text-sm font-medium text-telegram-text">
                                Длительность (сек)
                                <input
                                    type="number"
                                    min={0}
                                    value={addItemDuration}
                                    onChange={(e) => setAddItemDuration(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    placeholder={addItemKind === 'timer' ? '60' : 'Необязательно'}
                                />
                            </label>

                            <label className="block text-sm font-medium text-telegram-text">
                                Заметки
                                <textarea
                                    value={addItemNotes}
                                    onChange={(e) => setAddItemNotes(e.target.value)}
                                    rows={2}
                                    className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                />
                            </label>

                            <div className="flex gap-2">
                                <Button variant="secondary" fullWidth onClick={closeAddItemModal}>
                                    Отмена
                                </Button>
                                <Button fullWidth onClick={handleCreateItem}>
                                    Добавить
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    <Modal
                        isOpen={structureEditor != null}
                        onClose={closeStructureEditor}
                        title="Изменить структуру упражнения"
                        size="md"
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm font-medium text-telegram-text">
                                    Подходы
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={structureEditor?.sets ?? '1'}
                                        onChange={(e) =>
                                            setStructureEditor((prev) => prev ? { ...prev, sets: e.target.value } : prev)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    />
                                </label>
                                <label className="text-sm font-medium text-telegram-text">
                                    Повторы
                                    <input
                                        type="number"
                                        min={0}
                                        value={structureEditor?.reps ?? ''}
                                        onChange={(e) =>
                                            setStructureEditor((prev) => prev ? { ...prev, reps: e.target.value } : prev)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    />
                                </label>
                                <label className="text-sm font-medium text-telegram-text">
                                    Вес (кг)
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.5"
                                        value={structureEditor?.weight ?? ''}
                                        onChange={(e) =>
                                            setStructureEditor((prev) => prev ? { ...prev, weight: e.target.value } : prev)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    />
                                </label>
                                <label className="text-sm font-medium text-telegram-text">
                                    Длительность (сек)
                                    <input
                                        type="number"
                                        min={0}
                                        value={structureEditor?.duration ?? ''}
                                        onChange={(e) =>
                                            setStructureEditor((prev) => prev ? { ...prev, duration: e.target.value } : prev)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                    />
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" fullWidth onClick={closeStructureEditor}>
                                    Отмена
                                </Button>
                                <Button fullWidth onClick={handleSaveStructure}>
                                    Сохранить структуру
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    )
}
