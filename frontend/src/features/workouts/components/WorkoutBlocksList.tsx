import type { WorkoutBlock } from '@features/workouts/types/workoutBuilder'
import { TemplateBlockCard } from './TemplateBlockCard'

interface WorkoutBlocksListProps {
    blocks: WorkoutBlock[]
    onEdit: (block: WorkoutBlock) => void
    onDelete: (id: string) => void
    onReorder: (fromIndex: number, toIndex: number) => void
    reorderHint?: string | null
}

export function WorkoutBlocksList({ blocks, onEdit, onDelete, onReorder, reorderHint }: WorkoutBlocksListProps) {
    return (
        <div className="space-y-2">
            {blocks.map((block, index) => (
                <TemplateBlockCard
                    key={block.id}
                    block={block}
                    index={index}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveUp={() => onReorder(index, index - 1)}
                    onMoveDown={() => onReorder(index, index + 1)}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                    reorderHint={reorderHint}
                />
            ))}
        </div>
    )
}

