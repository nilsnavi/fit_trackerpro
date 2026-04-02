import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type SortableExerciseCardProps = {
    id: string
    children: ReactNode
    isActive: boolean
}

export function SortableExerciseCard({ id, children, isActive }: SortableExerciseCardProps) {
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
