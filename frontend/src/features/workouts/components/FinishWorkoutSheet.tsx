import { WorkoutModal } from './WorkoutModal'
import { Button } from '@shared/ui/Button'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface FinishWorkoutSheetProps {
    isOpen: boolean
    durationLabel: string
    completedExercises: CompletedExercise[]
    comment: string
    tagsDraft: string
    isPending: boolean
    errorMessage?: string | null
    syncState?: ActiveWorkoutSyncState
    isOnline?: boolean
    onRetryFinish?: () => void
    onSaveLocalFinish?: () => void
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
    syncState,
    isOnline = true,
    onRetryFinish,
    onSaveLocalFinish,
    onClose,
    onConfirm,
    onChangeTagsDraft,
}: FinishWorkoutSheetProps) {
    return (
        <WorkoutModal
            isOpen={isOpen}
            onClose={onClose}
            title="Завершение тренировки"
            description="Проверьте итог сессии перед сохранением результата в историю."
            size="md"
            bodyClassName="space-y-4"
            secondaryAction={{
                label: 'Вернуться к сессии',
                onClick: onClose,
                variant: 'secondary',
                disabled: isPending,
            }}
            primaryAction={{
                label: isPending ? 'Сохраняем…' : 'Подтвердить завершение',
                onClick: onConfirm,
                disabled: isPending,
                'data-testid': 'confirm-finish-btn',
            }}
        >
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

                {(syncState === 'offline-queued' || syncState === 'saved-locally' || !isOnline) && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-telegram-text">
                        Тренировка будет синхронизирована при восстановлении сети
                    </div>
                )}
                {syncState === 'error' && (
                    <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                        Не удалось синхронизировать последние изменения. Завершение поставит данные в очередь.
                    </div>
                )}

                {errorMessage && (
                    <p className="text-sm text-danger">{errorMessage}</p>
                )}

                {errorMessage && onRetryFinish && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="secondary" className="flex-1" disabled={isPending} onClick={onRetryFinish}>
                            Повторить
                        </Button>
                        {onSaveLocalFinish ? (
                            <Button type="button" variant="secondary" className="flex-1" disabled={isPending} onClick={onSaveLocalFinish}>
                                Сохранить локально и завершить
                            </Button>
                        ) : null}
                    </div>
                )}

        </WorkoutModal>
    )
}
