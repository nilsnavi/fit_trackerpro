import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

interface DeleteTemplateModalProps {
    isOpen: boolean
    templateName: string | null
    isDeleting: boolean
    onClose: () => void
    onConfirm: () => void
}

export function DeleteTemplateModal({
    isOpen,
    templateName,
    isDeleting,
    onClose,
    onConfirm,
}: DeleteTemplateModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Удалить шаблон" size="sm">
            <div className="space-y-4 p-1">
                <p className="text-sm text-telegram-text">
                    Удалить шаблон «{templateName ?? ''}»? Это действие нельзя отменить.
                </p>
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={isDeleting}>
                        Отмена
                    </Button>
                    <Button
                        variant="emergency"
                        fullWidth
                        onClick={onConfirm}
                        isLoading={isDeleting}
                        disabled={isDeleting}
                    >
                        Удалить
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
