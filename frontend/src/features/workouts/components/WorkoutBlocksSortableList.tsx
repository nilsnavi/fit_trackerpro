import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableTemplateBlock } from '@features/workouts/components/SortableTemplateBlock'
import type { WorkoutBlock } from '@features/workouts/types/workoutBuilder'

interface WorkoutBlocksSortableListProps {
    blocks: WorkoutBlock[]
    onEdit: (block: WorkoutBlock) => void
    onDelete: (id: string) => void
    onReorder: (fromIndex: number, toIndex: number) => void
}

export function WorkoutBlocksSortableList({
    blocks,
    onEdit,
    onDelete,
    onReorder,
}: WorkoutBlocksSortableListProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 140,
                tolerance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over || active.id === over.id) {
            return
        }

        const oldIndex = blocks.findIndex((item) => item.id === active.id)
        const newIndex = blocks.findIndex((item) => item.id === over.id)

        if (oldIndex >= 0 && newIndex >= 0) {
            onReorder(oldIndex, newIndex)
        }
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2">
                    {blocks.map((block, index) => (
                        <SortableTemplateBlock
                            key={block.id}
                            block={block}
                            index={index}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onMoveUp={() => onReorder(index, index - 1)}
                            onMoveDown={() => onReorder(index, index + 1)}
                            isFirst={index === 0}
                            isLast={index === blocks.length - 1}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}
