import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

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
        <Modal isOpen={isOpen} onClose={onClose} title="Отменить тренировку?" size="sm">
            <div className="space-y-4">
                <p className="text-sm text-telegram-text">
                    Текущая сессия будет отменена локально: черновик и активное состояние очистятся.
                </p>
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose}>
                        Продолжить тренировку
                    </Button>
                    <Button variant="emergency" fullWidth onClick={onConfirm}>
                        Подтвердить отмену
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
