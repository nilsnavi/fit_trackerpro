import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'
import type { WorkoutSessionListItem } from '@features/workouts/types/workouts'
import type { RestoreDecision } from '@features/workouts/hooks/useIncompleteWorkoutCheck'

export interface SessionRestoreDialogProps {
    session: WorkoutSessionListItem | null
    onDecide: (decision: RestoreDecision) => void
}

function formatDuration(totalSeconds: number | null | undefined): string {
    if (!totalSeconds || totalSeconds <= 0) return '—'
    const minutes = Math.floor(totalSeconds / 60)
    if (minutes < 1) return `${totalSeconds} сек`
    return `${minutes} мин`
}

/**
 * SPEC-005 §48 / AC-005-026: "У вас есть незавершённая тренировка".
 * Продолжить / Завершить / Отменить.
 */
export function SessionRestoreDialog({ session, onDecide }: SessionRestoreDialogProps) {
    if (!session) return null

    return (
        <Modal
            isOpen
            onClose={() => onDecide('continue')}
            title="Незавершённая тренировка"
            size="sm"
        >
            <div className="space-y-4 p-4" data-testid="session-restore-dialog">
                <p className="text-sm font-semibold text-telegram-text">
                    У вас есть незавершённая тренировка
                </p>
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-3">
                    <p className="text-base font-black text-telegram-text">
                        {session.name?.trim() || `Тренировка #${session.id}`}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-telegram-hint">
                        {formatDuration(session.elapsed_seconds)} · {session.completed_exercise_count}/
                        {session.exercise_count} упражнений
                    </p>
                </div>
                <div className="grid gap-2">
                    <Button
                        type="button"
                        className="min-h-[52px] rounded-2xl"
                        onClick={() => onDecide('continue')}
                        data-testid="restore-continue-btn"
                    >
                        Продолжить
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        className="min-h-[52px] rounded-2xl"
                        onClick={() => onDecide('finish')}
                        data-testid="restore-finish-btn"
                    >
                        Завершить
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        className="min-h-[52px] rounded-2xl text-danger"
                        onClick={() => onDecide('cancel')}
                        data-testid="restore-cancel-btn"
                    >
                        Отменить
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
