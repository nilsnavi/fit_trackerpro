import { WorkoutConfirmModal } from './WorkoutConfirmModal'

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
        <WorkoutConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Удалить шаблон"
            description={`Удалить шаблон «${templateName ?? ''}»? Это действие нельзя отменить.`}
            confirmLabel="Удалить"
            confirmVariant="emergency"
            isLoading={isDeleting}
        />
    )
}
