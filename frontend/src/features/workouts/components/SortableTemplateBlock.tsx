import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { Dumbbell, Heart, Timer, FileText, GripVertical, ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { WorkoutBlock } from '../types/workoutBuilder'

interface SortableTemplateBlockProps {
    block: WorkoutBlock
    index: number
    onEdit: (block: WorkoutBlock) => void
    onDelete: (id: string) => void
    onMoveUp: (index: number) => void
    onMoveDown: (index: number) => void
    isFirst: boolean
    isLast: boolean
}

const BLOCK_ICON_MAP = {
    strength: Dumbbell,
    cardio: Heart,
    timer: Timer,
    note: FileText,
} as const

function getBlockSummary(block: WorkoutBlock): string {
    if (!block.config) return ''
    const parts: string[] = []
    if (block.config.sets) parts.push(`${block.config.sets} подх.`)
    if (block.config.reps) parts.push(`${block.config.reps} повт.`)
    if (block.config.weight) parts.push(`${block.config.weight} кг`)
    if (block.config.duration) parts.push(`${block.config.duration} мин`)
    if (block.config.restSeconds) parts.push(`${block.config.restSeconds} сек отдых`)
    return parts.join(' • ')
}

export function SortableTemplateBlock({
    block,
    index,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: SortableTemplateBlockProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: block.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
    }

    const BlockIcon = BLOCK_ICON_MAP[block.type] ?? Dumbbell
    const summary = getBlockSummary(block)

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'tg-card flex items-center gap-3 p-3',
                'transition-shadow duration-200',
                isDragging && 'shadow-lg ring-2 ring-primary/30',
            )}
        >
            <button
                {...attributes}
                {...listeners}
                className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg cursor-grab active:cursor-grabbing"
                aria-label="Перетащить для сортировки"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                {index + 1}
            </div>

            <div className="w-10 h-10 rounded-xl bg-telegram-secondary-bg flex items-center justify-center text-telegram-text">
                <BlockIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-telegram-text truncate">
                    {block.exercise?.name || (block.type === 'note' ? 'Заметка' : 'Таймер')}
                </h4>
                <p className="text-sm text-telegram-hint truncate">
                    {summary || block.config?.note || 'Без настроек'}
                </p>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onMoveUp(index)}
                    disabled={isFirst}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg disabled:opacity-30"
                    aria-label="Переместить вверх"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onMoveDown(index)}
                    disabled={isLast}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg disabled:opacity-30"
                    aria-label="Переместить вниз"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onEdit(block)}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-primary hover:bg-primary/10"
                    aria-label="Редактировать"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(block.id)}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-danger hover:bg-danger/10"
                    aria-label="Удалить"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
