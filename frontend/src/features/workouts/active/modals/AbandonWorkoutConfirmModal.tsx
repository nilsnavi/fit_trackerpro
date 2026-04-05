import { WorkoutConfirmModal } from '@features/workouts/components/WorkoutConfirmModal'

interface AbandonWorkoutConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export function AbandonWorkoutConfirmModal({
    isOpen,
    onClose,
    onConfirm,
}: AbandonWorkoutConfirmModalProps) {
    return (
        <WorkoutConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Отменить тренировку?"
            description="Текущая сессия будет отменена локально: черновик и активное состояние очистятся."
            cancelLabel="Продолжить тренировку"
            confirmLabel="Подтвердить отмену"
            confirmVariant="emergency"
        />
    )
}
