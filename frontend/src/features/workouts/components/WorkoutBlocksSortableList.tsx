import { lazy, Suspense } from 'react'
import type { WorkoutBlock } from '@features/workouts/types/workoutBuilder'
import { WorkoutBlocksList } from './WorkoutBlocksList'

interface WorkoutBlocksSortableListProps {
    blocks: WorkoutBlock[]
    onEdit: (block: WorkoutBlock) => void
    onDelete: (id: string) => void
    onReorder: (fromIndex: number, toIndex: number) => void
}

const WorkoutBlocksSortableListImpl = lazy(() =>
    import('./WorkoutBlocksSortableList.impl').then((m) => ({ default: m.WorkoutBlocksSortableListImpl })),
)

export function WorkoutBlocksSortableList({
    blocks,
    onEdit,
    onDelete,
    onReorder,
}: WorkoutBlocksSortableListProps) {
    if (blocks.length <= 1) {
        return <WorkoutBlocksList blocks={blocks} onEdit={onEdit} onDelete={onDelete} onReorder={onReorder} />
    }

    return (
        <Suspense fallback={<WorkoutBlocksList blocks={blocks} onEdit={onEdit} onDelete={onDelete} onReorder={onReorder} />}>
            <WorkoutBlocksSortableListImpl blocks={blocks} onEdit={onEdit} onDelete={onDelete} onReorder={onReorder} />
        </Suspense>
    )
}
