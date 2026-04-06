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
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Minus, PencilRuler, Plus, Trash2 } from 'lucide-react'
import { SortableExerciseCard } from '@features/workouts/components/SortableExerciseCard'
import {
    formatExerciseStructureSummary,
    getExerciseSummaryMeta,
} from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import { ExerciseSetRow } from './ExerciseSetRow'

interface ActiveExerciseListProps {
    exercises: CompletedExercise[]
    currentExerciseIndex: number
    currentSetIndex: number
    previousBestLabelsByExercise: Map<string, string>
    canReorder: boolean
    onDragEnd: (event: DragEndEvent) => void
    onOpenStructureEditor: (exerciseIndex: number) => void
    onAddSet: () => void
    onRemoveSet: () => void
    onDeleteExercise: (exerciseIndex: number) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onToggleSetCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onSkipSet: () => void
    onCopyPreviousSet: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onNotesChange: (exerciseIndex: number, notes: string | undefined) => void
}

export const ActiveExerciseList = memo(function ActiveExerciseList({
    exercises,
    currentExerciseIndex,
    currentSetIndex,
    previousBestLabelsByExercise,
    canReorder,
    onDragEnd,
    onOpenStructureEditor,
    onAddSet,
    onRemoveSet,
    onDeleteExercise,
    onSetCurrentPosition,
    onToggleSetCompleted,
    onSkipSet,
    onCopyPreviousSet,
    onAdjustWeight,
    onUpdateSet,
    onNotesChange,
}: ActiveExerciseListProps) {
    const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Record<string, true>>({})

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const sortableIds = useMemo(
        () => exercises.map((exercise, index) => `${exercise.exercise_id}-${index}`),
        [exercises],
    )

    const toggleCollapsed = (id: string) => {
        setCollapsedExerciseIds((prev) => {
            if (prev[id]) {
                const next = { ...prev }
                delete next[id]
                return next
            }

            return { ...prev, [id]: true }
        })
    }

    return (
        <div className="space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                    items={sortableIds}
                    strategy={verticalListSortingStrategy}
                >
                    {exercises.map((exercise, exerciseIndex) => {
                        const itemId = `${exercise.exercise_id}-${exerciseIndex}`
                        const summaryMeta = getExerciseSummaryMeta(exercise)
                        const SummaryIcon = summaryMeta.icon
                        const isCurrentExercise = exerciseIndex === currentExerciseIndex
                        const isCollapsed = Boolean(collapsedExerciseIds[itemId]) && !isCurrentExercise
                        const previousBestLabel =
                            previousBestLabelsByExercise.get(exercise.name.trim().toLowerCase()) ?? 'Нет данных'

                        return (
                            <SortableExerciseCard
                                key={itemId}
                                id={itemId}
                                isActive={canReorder}
                            >
                                <div
                                    className={`rounded-xl bg-telegram-secondary-bg p-4 ${summaryMeta.borderClass} ${isCurrentExercise ? 'ring-2 ring-primary/25' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-semibold text-telegram-text">{exercise.name}</h2>
                                                {isCurrentExercise && (
                                                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                                        Сейчас
                                                    </span>
                                                )}
                                            </div>
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
                                                <p className="text-[11px] leading-4 text-telegram-hint">
                                                    Предыдущий лучший: {previousBestLabel}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onOpenStructureEditor(exerciseIndex)}
                                                className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg"
                                                aria-label="Изменить структуру упражнения"
                                            >
                                                <PencilRuler className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleCollapsed(itemId)}
                                                className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg"
                                                aria-label={isCollapsed ? 'Развернуть упражнение' : 'Свернуть упражнение'}
                                            >
                                                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteExercise(exerciseIndex)}
                                                className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-danger active:bg-danger/10"
                                                aria-label="Удалить упражнение"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                                #{exercise.exercise_id}
                                            </span>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <>
                                            <div className="mt-2 space-y-2">
                                                {exercise.sets_completed.map((set) => (
                                                    <ExerciseSetRow
                                                        key={set.set_number}
                                                        set={set}
                                                        exerciseIndex={exerciseIndex}
                                                        isCurrent={
                                                            isCurrentExercise &&
                                                            set.set_number - 1 === currentSetIndex
                                                        }
                                                        previousBestLabel={previousBestLabel}
                                                        onFocusSet={onSetCurrentPosition}
                                                        onToggleCompleted={onToggleSetCompleted}
                                                        onSkipSet={onSkipSet}
                                                        onCopyPrevious={onCopyPreviousSet}
                                                        onAdjustWeight={onAdjustWeight}
                                                        onUpdateSet={onUpdateSet}
                                                    />
                                                ))}
                                            </div>

                                            {isCurrentExercise && (
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={onRemoveSet}
                                                        disabled={exercise.sets_completed.length <= 1}
                                                        className="flex min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint disabled:opacity-50"
                                                    >
                                                        <Minus className="h-3.5 w-3.5" />
                                                        Убрать подход
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={onAddSet}
                                                        className="flex min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        Добавить подход
                                                    </button>
                                                </div>
                                            )}

                                            <div className="mt-3">
                                                <label className="block text-xs font-medium text-telegram-hint">Заметки к упражнению</label>
                                                <textarea
                                                    value={exercise.notes ?? ''}
                                                    onChange={(e) => onNotesChange(exerciseIndex, e.target.value || undefined)}
                                                    rows={2}
                                                    className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </SortableExerciseCard>
                        )
                    })}
                </SortableContext>
            </DndContext>
        </div>
    )
})

ActiveExerciseList.displayName = 'ActiveExerciseList'
