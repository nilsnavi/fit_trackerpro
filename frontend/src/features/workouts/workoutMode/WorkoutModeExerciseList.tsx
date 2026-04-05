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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useCallback, useMemo, useRef } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { WorkoutModeExerciseCard } from './WorkoutModeExerciseCard'
import type { ModeExerciseParams, WorkoutModeExerciseItem } from './workoutModeEditorTypes'

// ── Sortable wrapper ──────────────────────────────────────────────────────────

const SortableExerciseItem = memo(function SortableExerciseItem({
    item,
    index,
    onUpdate,
    onRemove,
}: {
    item: WorkoutModeExerciseItem
    index: number
    onUpdate: (id: string, params: ModeExerciseParams) => void
    onRemove: (id: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style}>
            <WorkoutModeExerciseCard
                item={item}
                index={index}
                onUpdate={onUpdate}
                onRemove={onRemove}
                isDragging={isDragging}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    )
})

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyExercises = memo(function EmptyExercises({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-telegram-secondary-bg px-6 py-10">
            <div className="rounded-2xl bg-telegram-bg p-4">
                <Dumbbell className="h-8 w-8 text-telegram-hint" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-telegram-text">Пока нет упражнений</p>
                <p className="mt-1 text-xs text-telegram-hint">
                    Добавьте упражнения, чтобы составить тренировку
                </p>
            </div>
            <Button variant="secondary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>
                Добавить упражнение
            </Button>
        </div>
    )
})

// ── Public component ──────────────────────────────────────────────────────────

interface WorkoutModeExerciseListProps {
    containerId?: string
    exercises: WorkoutModeExerciseItem[]
    error?: string
    onAdd: () => void
    onUpdate: (id: string, params: ModeExerciseParams) => void
    onRemove: (id: string) => void
    onReorder: (fromIndex: number, toIndex: number) => void
}

export const WorkoutModeExerciseList = memo(function WorkoutModeExerciseList({
    containerId,
    exercises,
    error,
    onAdd,
    onUpdate,
    onRemove,
    onReorder,
}: WorkoutModeExerciseListProps) {
    const sensors = useSensors(
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const sortableIds = useMemo(() => exercises.map((ex) => ex.id), [exercises])
    
    // Store exercises reference to avoid dependency in useCallback
    const exercisesRef = useRef(exercises)
    exercisesRef.current = exercises

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        // Use ref to get current exercises without adding dependency
        const from = exercisesRef.current.findIndex((ex) => ex.id === active.id)
        const to = exercisesRef.current.findIndex((ex) => ex.id === over.id)
        if (from !== -1 && to !== -1) onReorder(from, to)
    }, [onReorder])

    return (
        <div id={containerId} data-invalid={Boolean(error)} tabIndex={-1} className="space-y-3 outline-none">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-telegram-text">
                    Упражнения{exercises.length > 0 && ` (${exercises.length})`}
                </h2>
                {exercises.length > 0 && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Добавить
                    </button>
                )}
            </div>

            {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                    {error}
                </p>
            )}

            {exercises.length === 0 ? (
                <EmptyExercises onAdd={onAdd} />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortableIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {exercises.map((item, index) => (
                                <SortableExerciseItem
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onUpdate={onUpdate}
                                    onRemove={onRemove}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    )
})

SortableExerciseItem.displayName = 'SortableExerciseItem'
EmptyExercises.displayName = 'EmptyExercises'
WorkoutModeExerciseList.displayName = 'WorkoutModeExerciseList'
