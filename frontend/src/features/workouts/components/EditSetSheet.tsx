import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Modal } from '@shared/ui/Modal'
import { Input } from '@shared/ui/Input'
import { Button } from '@shared/ui/Button'
import { usePatchWorkoutSetMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { toast } from '@shared/stores/toastStore'
import type { CompletedSet, WorkoutSetPatchRequest } from '@features/workouts/types/workouts'

export interface EditSetSheetProps {
    isOpen: boolean
    onClose: () => void
    workoutId: number
    exerciseId: number
    exerciseName: string
    setNumber: number
    setId: number
    initialData: CompletedSet
}

/**
 * Mobile-friendly bottom sheet for editing a completed set.
 * Allows editing reps, weight, rpe, and completed status.
 */
export function EditSetSheet({
    isOpen,
    onClose,
    workoutId,
    exerciseName,
    setNumber,
    setId,
    initialData,
}: EditSetSheetProps) {
    const [reps, setReps] = useState<string>(initialData.reps?.toString() ?? '')
    const [weight, setWeight] = useState<string>(initialData.weight?.toString() ?? '')
    const [rpe, setRpe] = useState<string>(initialData.rpe?.toString() ?? '')
    const [completed, setCompleted] = useState(initialData.completed)
    const [notes, setNotes] = useState<string>(initialData.notes ?? '')

    const patchSetMutation = usePatchWorkoutSetMutation()

    // Reset form when initial data changes
    useEffect(() => {
        if (isOpen) {
            setReps(initialData.reps?.toString() ?? '')
            setWeight(initialData.weight?.toString() ?? '')
            setRpe(initialData.rpe?.toString() ?? '')
            setCompleted(initialData.completed)
            setNotes(initialData.notes ?? '')
        }
    }, [isOpen, initialData])

    const handleSave = useCallback(async () => {
        const payload: WorkoutSetPatchRequest = {}

        const repsNum = reps === '' ? null : Number.parseInt(reps, 10)
        const weightNum = weight === '' ? null : Number.parseFloat(weight)
        const rpeNum = rpe === '' ? null : Number.parseFloat(rpe)

        // Only include changed values
        if (repsNum !== null && !Number.isNaN(repsNum) && repsNum !== initialData.reps) {
            payload.reps = repsNum
        }
        if (weightNum !== null && !Number.isNaN(weightNum) && weightNum !== initialData.weight) {
            payload.weight = weightNum
        }
        if (rpeNum !== null && !Number.isNaN(rpeNum) && rpeNum !== initialData.rpe) {
            payload.rpe = rpeNum
        }
        if (completed !== initialData.completed) {
            payload.completed = completed
        }
        if (notes !== (initialData.notes ?? '')) {
            payload.notes = notes || null
        }

        // If nothing changed, just close
        if (Object.keys(payload).length === 0) {
            onClose()
            return
        }

        try {
            await patchSetMutation.mutateAsync({
                workoutId,
                setId,
                payload,
            })
            toast.success('Подход обновлён', { toastKey: 'set-saved' })
            onClose()
        } catch {
            // Error is handled in mutation hook
        }
    }, [reps, weight, rpe, completed, notes, initialData, patchSetMutation, workoutId, setId, onClose])

    const handleClose = useCallback(() => {
        if (patchSetMutation.isPending) return
        onClose()
    }, [patchSetMutation.isPending, onClose])

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Подход ${setNumber}`}
            description={`${exerciseName}`}
            size="md"
        >
            <div className="space-y-4">
                {/* Reps input */}
                <div>
                    <label className="block text-xs font-medium text-telegram-hint mb-1.5">
                        Повторы
                    </label>
                    <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="—"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        disabled={patchSetMutation.isPending}
                        haptic={false}
                    />
                </div>

                {/* Weight input */}
                <div>
                    <label className="block text-xs font-medium text-telegram-hint mb-1.5">
                        Вес (кг)
                    </label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        placeholder="—"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        disabled={patchSetMutation.isPending}
                        haptic={false}
                    />
                </div>

                {/* RPE input */}
                <div>
                    <label className="block text-xs font-medium text-telegram-hint mb-1.5">
                        RPE (1-10)
                    </label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="1"
                        max="10"
                        placeholder="—"
                        value={rpe}
                        onChange={(e) => setRpe(e.target.value)}
                        disabled={patchSetMutation.isPending}
                        haptic={false}
                    />
                </div>

                {/* Notes input */}
                <div>
                    <label className="block text-xs font-medium text-telegram-hint mb-1.5">
                        Заметки
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={patchSetMutation.isPending}
                        placeholder="Добавить заметку к подходу..."
                        rows={2}
                        className={`
                            w-full px-4 py-3 rounded-xl
                            bg-telegram-secondary-bg text-telegram-text
                            placeholder:text-telegram-hint/50
                            border border-transparent
                            focus:outline-none focus:ring-2 focus:ring-primary/30
                            resize-none text-sm
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    />
                </div>

                {/* Completed toggle */}
                <div>
                    <label className="block text-xs font-medium text-telegram-hint mb-1.5">
                        Статус
                    </label>
                    <button
                        type="button"
                        onClick={() => setCompleted(!completed)}
                        disabled={patchSetMutation.isPending}
                        className={`
                            w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                            transition-colors text-left
                            ${completed
                                ? 'bg-success/15 text-success'
                                : 'bg-telegram-secondary-bg text-telegram-hint'
                            }
                            ${patchSetMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}
                        `}
                    >
                        <span className="text-sm font-medium">
                            {completed ? 'Выполнен' : 'Не выполнен'}
                        </span>
                        <span className={`
                            w-6 h-6 rounded-full flex items-center justify-center
                            ${completed ? 'bg-success text-white' : 'bg-telegram-bg'}
                        `}>
                            {completed && <Check className="w-4 h-4" />}
                        </span>
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleClose}
                        disabled={patchSetMutation.isPending}
                        className="flex-1"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSave()}
                        isLoading={patchSetMutation.isPending}
                        disabled={patchSetMutation.isPending}
                        className="flex-1"
                    >
                        Сохранить
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
