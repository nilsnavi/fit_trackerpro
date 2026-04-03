import { memo, useCallback, useState } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@shared/ui/Modal'
import { ExerciseModeConfigForm } from './ExerciseModeConfigForm'
import type {
    CardioExerciseParams,
    FunctionalExerciseParams,
    ModeExerciseParams,
    StrengthExerciseParams,
    WorkoutModeExerciseItem,
    YogaExerciseParams,
} from './workoutModeEditorTypes'

interface WorkoutModeExerciseCardProps {
    item: WorkoutModeExerciseItem
    index: number
    onUpdate: (id: string, params: ModeExerciseParams) => void
    onRemove: (id: string) => void
    /** Pass isDragging=true during dnd to suppress pointer events */
    isDragging?: boolean
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

// ── Summary renderers ─────────────────────────────────────────────────────────

function StrengthSummary({ p }: { p: StrengthExerciseParams }) {
    const parts = [`${p.sets} × ${p.reps} повт.`]
    if (p.weight) parts.push(`${p.weight} кг`)
    if (p.restSeconds) parts.push(`отдых ${p.restSeconds} с`)
    return <p className="text-xs text-telegram-hint">{parts.join(' · ')}</p>
}

function CardioSummary({ p }: { p: CardioExerciseParams }) {
    const min = Math.round(p.durationSeconds / 60)
    const parts = [`${min} мин`]
    if (p.distance) parts.push(`${p.distance} км`)
    if (p.intensity) {
        const labels = { low: 'низкая', medium: 'средняя', high: 'высокая' }
        parts.push(labels[p.intensity])
    }
    return <p className="text-xs text-telegram-hint">{parts.join(' · ')}</p>
}

function FunctionalSummary({ p }: { p: FunctionalExerciseParams }) {
    const parts = [`${p.rounds} ×`]
    if (p.reps) parts.push(`${p.reps} повт.`)
    if (p.durationSeconds) parts.push(`${p.durationSeconds} с`)
    if (p.restSeconds) parts.push(`отдых ${p.restSeconds} с`)
    return <p className="text-xs text-telegram-hint">{parts.join(' ')}</p>
}

function YogaSummary({ p }: { p: YogaExerciseParams }) {
    return <p className="text-xs text-telegram-hint">{p.durationSeconds} с удержания</p>
}

function ExerciseSummary({ item }: { item: WorkoutModeExerciseItem }) {
    switch (item.mode) {
        case 'strength':
            return <StrengthSummary p={item.params as StrengthExerciseParams} />
        case 'cardio':
            return <CardioSummary p={item.params as CardioExerciseParams} />
        case 'functional':
            return <FunctionalSummary p={item.params as FunctionalExerciseParams} />
        case 'yoga':
            return <YogaSummary p={item.params as YogaExerciseParams} />
    }
}

// ── Main component ────────────────────────────────────────────────────────────

export const WorkoutModeExerciseCard = memo(function WorkoutModeExerciseCard({
    item,
    index,
    onUpdate,
    onRemove,
    isDragging,
    dragHandleProps,
}: WorkoutModeExerciseCardProps) {
    const [editOpen, setEditOpen] = useState(false)
    const handleOpenEdit = useCallback(() => setEditOpen(true), [])
    const handleCloseEdit = useCallback(() => setEditOpen(false), [])
    const handleRemove = useCallback(() => onRemove(item.id), [item.id, onRemove])
    const handleConfirm = useCallback((params: ModeExerciseParams) => {
        onUpdate(item.id, params)
        setEditOpen(false)
    }, [item.id, onUpdate])

    return (
        <>
            <div
                className={`flex items-center gap-3 rounded-xl border bg-telegram-secondary-bg p-3 transition-shadow ${
                    isDragging ? 'shadow-lg opacity-80 border-primary/50' : 'border-border'
                }`}
            >
                {/* Drag handle */}
                <div
                    {...dragHandleProps}
                    className="cursor-grab touch-none select-none text-telegram-hint active:cursor-grabbing"
                    aria-label="Перетащить упражнение"
                >
                    <GripVertical className="h-5 w-5" />
                </div>

                {/* Index badge */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                </span>

                {/* Text info */}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-telegram-text">{item.name}</p>
                    <ExerciseSummary item={item} />
                    {(item.params as StrengthExerciseParams).note && (
                        <p className="mt-0.5 truncate text-xs italic text-telegram-hint">
                            {(item.params as StrengthExerciseParams).note}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={handleOpenEdit}
                        className="rounded-lg p-2 text-telegram-hint transition-colors hover:bg-telegram-bg hover:text-primary"
                        aria-label="Редактировать"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="rounded-lg p-2 text-telegram-hint transition-colors hover:bg-telegram-bg hover:text-danger"
                        aria-label="Удалить"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Edit modal */}
            <Modal
                isOpen={editOpen}
                onClose={handleCloseEdit}
                title="Редактировать упражнение"
                size="md"
                haptic
            >
                <ExerciseModeConfigForm
                    mode={item.mode}
                    exerciseName={item.name}
                    initial={item.params}
                    onConfirm={handleConfirm}
                    onCancel={handleCloseEdit}
                />
            </Modal>
        </>
    )
})

WorkoutModeExerciseCard.displayName = 'WorkoutModeExerciseCard'
