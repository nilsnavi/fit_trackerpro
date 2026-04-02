import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import type { CompletedExercise } from '@features/workouts/types/workouts'

interface FinishWorkoutSheetProps {
    isOpen: boolean
    durationLabel: string
    completedExercises: CompletedExercise[]
    comment: string
    tagsDraft: string
    isPending: boolean
    errorMessage?: string | null
    onClose: () => void
    onConfirm: () => void
    onChangeTagsDraft: (value: string) => void
}

export function FinishWorkoutSheet({
    isOpen,
    durationLabel,
    completedExercises,
    comment,
    tagsDraft,
    isPending,
    errorMessage,
    onClose,
    onConfirm,
    onChangeTagsDraft,
}: FinishWorkoutSheetProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Завершение тренировки" size="md">
            <div className="space-y-4">
                <div className="rounded-lg bg-telegram-bg/60 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-telegram-hint">Длительность</span>
                        <span className="font-medium text-telegram-text">{durationLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-telegram-hint">Выполненные упражнения</span>
                        <span className="font-medium text-telegram-text">{completedExercises.length}</span>
                    </div>
                    <div className="space-y-1">
                        {completedExercises.length > 0 ? (
                            completedExercises.slice(0, 5).map((exercise) => (
                                <p key={exercise.exercise_id} className="text-xs text-telegram-text">
                                    • {exercise.name}
                                </p>
                            ))
                        ) : (
                            <p className="text-xs text-telegram-hint">Пока нет выполненных упражнений</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-telegram-hint">Комментарий</p>
                    <div className="rounded-lg bg-telegram-bg/60 p-2 text-sm text-telegram-text">
                        {comment.trim() || 'Без комментария'}
                    </div>
                </div>

                <label className="block text-sm font-medium text-telegram-text">
                    Теги (через запятую)
                    <input
                        type="text"
                        value={tagsDraft}
                        onChange={(e) => onChangeTagsDraft(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        placeholder="силовая, ноги, прогресс"
                    />
                </label>

                {errorMessage && (
                    <p className="text-sm text-danger">{errorMessage}</p>
                )}

                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={isPending}>
                        Вернуться к сессии
                    </Button>
                    <Button fullWidth disabled={isPending} onClick={onConfirm}>
                        {isPending ? 'Сохраняем…' : 'Подтвердить завершение'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
