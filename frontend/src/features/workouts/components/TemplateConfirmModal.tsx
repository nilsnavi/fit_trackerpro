import { WorkoutConfirmModal } from './WorkoutConfirmModal'

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
        <WorkoutConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            confirmVariant="emergency"
            isLoading={isLoading}
        />
    )
}
