import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

interface TemplateConfirmModalProps {
    isOpen: boolean
    title: string
    description: string
    confirmLabel: string
    isLoading: boolean
    onClose: () => void
    onConfirm: () => void
}

export function TemplateConfirmModal({
    isOpen,
    title,
    description,
    confirmLabel,
    isLoading,
    onClose,
    onConfirm,
}: TemplateConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="space-y-4 p-1">
                <p className="text-sm text-telegram-text">{description}</p>
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={isLoading}>
                        Отмена
                    </Button>
                    <Button
                        variant="emergency"
                        fullWidth
                        onClick={onConfirm}
                        isLoading={isLoading}
                        disabled={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
