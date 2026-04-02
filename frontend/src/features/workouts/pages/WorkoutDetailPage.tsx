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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    Dumbbell,
    GripVertical,
    HeartPulse,
    MessageSquare,
    PencilRuler,
    Plus,
    Search,
    Tags,
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
import type {
    CompletedExercise,
    WorkoutCompleteRequest,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'

const formatDate = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const formatDurationMinutes = (duration?: number): string => {
    if (typeof duration !== 'number' || duration <= 0) {
        return '—'
    }
    return `${duration} мин`
}

const formatSetValue = (value?: number, unit?: string): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—'
    }
    return unit ? `${value} ${unit}` : `${value}`
}

function parseOptionalNumber(raw: string): number | undefined {
    if (raw.trim() === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
}

function pluralizeRu(value: number, forms: [string, string, string]): string {
    const absValue = Math.abs(value)
    const mod10 = absValue % 10
    const mod100 = absValue % 100

    if (mod100 >= 11 && mod100 <= 14) {
        return forms[2]
    }
    if (mod10 === 1) {
        return forms[0]
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return forms[1]
    }
    return forms[2]
}

type ExerciseSummaryTone = 'strength' | 'cardio' | 'timer'

function getExerciseSummaryMeta(exercise: CompletedExercise): {
    tone: ExerciseSummaryTone
    label: string
    reason: string
    mobileReason: string
    icon: typeof Dumbbell
    className: string
    borderClass: string
} {
    const setsCount = exercise.sets_completed.length
    const firstSet = exercise.sets_completed[0]
    const hasWeight = firstSet?.weight != null && firstSet.weight > 0
    const hasReps = firstSet?.reps != null && firstSet.reps > 0
    const hasDuration = firstSet?.duration != null && firstSet.duration > 0

    if (hasDuration && !hasWeight && !hasReps) {
        return {
            tone: 'timer',
            label: setsCount > 1 ? 'Интервал' : 'Таймер',
            reason: setsCount > 1
                ? 'Есть несколько временных отрезков без повторов и рабочего веса.'
                : 'Есть длительность подхода без повторов и рабочего веса.',
            mobileReason: setsCount > 1 ? 'По времени, без веса' : 'Только время, без веса',
            icon: Timer,
            className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            borderClass: 'border-l-4 border-l-amber-400 dark:border-l-amber-500',
        }
    }
    if (hasDuration && !hasWeight) {
        return {
            tone: 'cardio',
            label: setsCount > 1 ? 'Интервалы' : 'Кардио',
            reason: hasReps
                ? 'Есть длительность подходов и работа строится по времени, а не по весу.'
                : 'Есть длительность активности без рабочего веса.',
            mobileReason: hasReps ? 'Работа по времени' : 'Длительность без веса',
            icon: HeartPulse,
            className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
            borderClass: 'border-l-4 border-l-rose-400 dark:border-l-rose-500',
        }
    }
    return {
        tone: 'strength',
        label: hasWeight ? 'Силовая' : 'Повторы',
        reason: hasWeight
            ? 'Карточка считается силовой, потому что в подходах указан рабочий вес.'
            : 'Карточка считается силовой, потому что в подходах есть повторы без временного интервала.',
        mobileReason: hasWeight ? 'Есть рабочий вес' : 'Повторы без таймера',
        icon: Dumbbell,
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        borderClass: 'border-l-4 border-l-blue-400 dark:border-l-blue-500',
    }
}

function formatExerciseStructureSummary(exercise: CompletedExercise): string {
    const setsCount = exercise.sets_completed.length
    const firstSet = exercise.sets_completed[0]
    const parts: string[] = [
        `${setsCount} ${pluralizeRu(setsCount, ['подход', 'подхода', 'подходов'])}`,
    ]

    if (firstSet?.reps != null) {
        parts.push(`${firstSet.reps} ${pluralizeRu(firstSet.reps, ['повтор', 'повтора', 'повторов'])}`)
    }
    if (firstSet?.weight != null) {
        parts.push(`${firstSet.weight} ${pluralizeRu(firstSet.weight, ['килограмм', 'килограмма', 'килограммов'])}`)
    }
    if (firstSet?.duration != null) {
        parts.push(`${firstSet.duration} ${pluralizeRu(firstSet.duration, ['секунда', 'секунды', 'секунд'])}`)
    }

    return parts.join(' • ')
}

type AddItemKind = 'exercise' | 'timer'
type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility'

type StructureEditorState = {
    exerciseIndex: number
    sets: string
    reps: string
    weight: string
    duration: string
} | null

type SortableExerciseCardProps = {
    id: string
    children: React.ReactNode
    isActive: boolean
}

function SortableExerciseCard({ id, children, isActive }: SortableExerciseCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !isActive,
    })

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                zIndex: isDragging ? 30 : 1,
            }}
            className={isDragging ? 'opacity-90' : undefined}
        >
            <div className="flex items-start gap-2">
                {isActive && (
                    <button
                        type="button"
                        className="mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint touch-none"
                        aria-label="Перетащить упражнение"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                )}
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    )
}

function buildSessionUpdatePayload(workout: WorkoutHistoryItem): WorkoutSessionUpdateRequest {
    return {
        exercises: workout.exercises,
        comments: workout.comments,
        tags: workout.tags ?? [],
        glucose_before: workout.glucose_before,
        glucose_after: workout.glucose_after,
    }
}

function buildRepeatExercises(exercises: CompletedExercise[]): CompletedExercise[] {
    return exercises.map((exercise) => ({
        ...exercise,
        sets_completed: exercise.sets_completed.map((setItem) => ({
            ...setItem,
            completed: false,
            rpe: undefined,
            rir: undefined,
        })),
    }))
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()
    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)
    const abandonWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.abandonDraft)

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
        () => (isActiveDraft && workout ? buildSessionUpdatePayload(workout) : null),
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

    const repeatSource = useMemo(() => {
        if (!workout) return null
        const title = workout.comments?.trim() ?? ''
        if (!title) return null
        const items = historyData?.items ?? []
        return items.find((item) => item.id !== workout.id && item.comments?.trim() === title) ?? null
    }, [historyData, workout])

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
            updateSessionMutation.mutate(
                { workoutId, payload: activeSessionPayload },
                {
                    onSuccess: (data) => {
                        lastPersistedSnapshotRef.current = activeSessionSnapshot
                        queryClient.setQueryData(detailQueryKey, data)
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
        abandonWorkoutSessionDraft()
        navigate('/workouts')
    }

    const handleCompleteSession = () => {
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
            tags: current.tags ?? [],
            glucose_before: current.glucose_before,
            glucose_after: current.glucose_after,
        }
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        completeMutation.mutate({ workoutId, payload })
    }

    const displayDurationLabel = isActiveDraft
        ? formatDurationMinutes(durationMinutes)
        : formatDurationMinutes(workout?.duration)

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate('/workouts')}
                    className="w-9 h-9 rounded-full bg-telegram-secondary-bg flex items-center justify-center text-telegram-text"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-xl font-bold text-telegram-text">Детали тренировки</h1>
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
                                    {displayDurationLabel}
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

                        {workout.comments && !isActiveDraft && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <MessageSquare className="w-4 h-4 mt-0.5" />
                                <span>{workout.comments}</span>
                            </div>
                        )}
                        {isActiveDraft && (
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
                        )}
                        {workout.tags.length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <Tags className="w-4 h-4 mt-0.5" />
                                <span>{workout.tags.join(', ')}</span>
                            </div>
                        )}
                    </div>

                    {sessionError && (
                        <p className="text-sm text-danger">{sessionError}</p>
                    )}
                    {completeMutation.isError && (
                        <p className="text-sm text-danger">
                            {getErrorMessage(completeMutation.error)}
                        </p>
                    )}
                    {isActiveDraft && updateSessionMutation.isError && (
                        <p className="text-sm text-danger">
                            {getErrorMessage(updateSessionMutation.error)}
                        </p>
                    )}

                    {isActiveDraft && (
                        <Button
                            type="button"
                            className="w-full"
                            disabled={completeMutation.isPending}
                            onClick={handleCompleteSession}
                        >
                            {completeMutation.isPending ? 'Сохранение…' : 'Завершить тренировку'}
                        </Button>
                    )}

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
                                        isActive={isActiveDraft}
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
                                        {isActiveDraft && (
                                            <>
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
                                            </>
                                        )}
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
                                                {isActiveDraft ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            tg.hapticFeedback({ type: 'selection' })
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                completed: !set.completed,
                                                            })
                                                        }}
                                                        className={`px-2 py-0.5 rounded-full text-xs transition-colors ${set.completed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {set.completed ? 'Выполнен' : 'Отметить'}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-xs ${set.completed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {set.completed ? 'Выполнен' : 'Не выполнен'}
                                                    </span>
                                                )}
                                            </div>
                                            {isActiveDraft ? (
                                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                    <label className="text-xs text-telegram-hint">
                                                        Повторы
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={set.reps ?? ''}
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
                                                            onChange={(e) =>
                                                                updateSet(exerciseIndex, set.set_number, {
                                                                    duration: parseOptionalNumber(e.target.value),
                                                                })
                                                            }
                                                            className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                    <span className="px-2 py-1 rounded-md bg-telegram-bg/60">
                                                        Повторы: {formatSetValue(set.reps, 'повт')}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-telegram-bg/60">
                                                        Вес: {formatSetValue(set.weight, 'кг')}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-telegram-bg/60">
                                                        RPE: {formatSetValue(set.rpe)}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-telegram-bg/60">
                                                        RIR: {formatSetValue(set.rir)}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-telegram-bg/60">
                                                        Время: {formatSetValue(set.duration, 'сек')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {isActiveDraft ? (
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
                                ) : exercise.notes ? (
                                    <p className="mt-2 text-sm text-telegram-hint">{exercise.notes}</p>
                                ) : null}
                                        </div>
                                    </SortableExerciseCard>
                                    )
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>

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
