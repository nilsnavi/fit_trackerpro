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
import { memo, useMemo } from 'react'
import { PencilRuler, Trash2 } from 'lucide-react'
import { SortableExerciseCard } from '@features/workouts/components/SortableExerciseCard'
import {
    formatExerciseStructureSummary,
    getExerciseSummaryMeta,
} from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import { ExerciseSetRow } from './ExerciseSetRow'

interface ActiveExerciseListProps {
    exercises: CompletedExercise[]
    canReorder: boolean
    onDragEnd: (event: DragEndEvent) => void
    onOpenStructureEditor: (exerciseIndex: number) => void
    onDeleteExercise: (exerciseIndex: number) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onToggleSetCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onCopyPreviousSet: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onNotesChange: (exerciseIndex: number, notes: string | undefined) => void
}

export const ActiveExerciseList = memo(function ActiveExerciseList({
    exercises,
    canReorder,
    onDragEnd,
    onOpenStructureEditor,
    onDeleteExercise,
    onSetCurrentPosition,
    onToggleSetCompleted,
    onCopyPreviousSet,
    onAdjustWeight,
    onUpdateSet,
    onNotesChange,
}: ActiveExerciseListProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const sortableIds = useMemo(
        () => exercises.map((exercise, index) => `${exercise.exercise_id}-${index}`),
        [exercises],
    )

    return (
        <div className="space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                    items={sortableIds}
                    strategy={verticalListSortingStrategy}
                >
                    {exercises.map((exercise, exerciseIndex) => {
                        const summaryMeta = getExerciseSummaryMeta(exercise)
                        const SummaryIcon = summaryMeta.icon
                        return (
                            <SortableExerciseCard
                                key={`${exercise.exercise_id}-${exerciseIndex}`}
                                id={`${exercise.exercise_id}-${exerciseIndex}`}
                                isActive={canReorder}
                            >
                                <div className={`rounded-xl bg-telegram-secondary-bg p-4 ${summaryMeta.borderClass}`}>
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
                                                onClick={() => onOpenStructureEditor(exerciseIndex)}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint"
                                                aria-label="Изменить структуру упражнения"
                                            >
                                                <PencilRuler className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteExercise(exerciseIndex)}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-danger"
                                                aria-label="Удалить упражнение"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                #{exercise.exercise_id}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-2 space-y-2">
                                        {exercise.sets_completed.map((set) => (
                                            <ExerciseSetRow
                                                key={set.set_number}
                                                set={set}
                                                exerciseIndex={exerciseIndex}
                                                onFocusSet={onSetCurrentPosition}
                                                onToggleCompleted={onToggleSetCompleted}
                                                onCopyPrevious={onCopyPreviousSet}
                                                onAdjustWeight={onAdjustWeight}
                                                onUpdateSet={onUpdateSet}
                                            />
                                        ))}
                                    </div>

                                    <div className="mt-3">
                                        <label className="block text-xs font-medium text-telegram-hint">Заметки к упражнению</label>
                                        <textarea
                                            value={exercise.notes ?? ''}
                                            onChange={(e) => onNotesChange(exerciseIndex, e.target.value || undefined)}
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
    )
})

ActiveExerciseList.displayName = 'ActiveExerciseList'
