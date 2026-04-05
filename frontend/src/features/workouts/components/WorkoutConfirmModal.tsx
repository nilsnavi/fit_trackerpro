import { WorkoutModal } from './WorkoutModal'

interface WorkoutConfirmModalProps {
    isOpen: boolean
    title: string
    description: string
    confirmLabel: string
    onClose: () => void
    onConfirm: () => void
    cancelLabel?: string
    confirmVariant?: 'primary' | 'emergency'
    isLoading?: boolean
    size?: 'sm' | 'md'
}

export function WorkoutConfirmModal({
    isOpen,
    title,
    description,
    confirmLabel,
    onClose,
    onConfirm,
    cancelLabel = 'Отмена',
    confirmVariant = 'primary',
    isLoading = false,
    size = 'sm',
}: WorkoutConfirmModalProps) {
    return (
        <WorkoutModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size={size}
            primaryAction={{
                label: confirmLabel,
                onClick: onConfirm,
                variant: confirmVariant,
                isLoading,
                disabled: isLoading,
            }}
            secondaryAction={{
                label: cancelLabel,
                onClick: onClose,
                variant: 'secondary',
                disabled: isLoading,
            }}
        >
            <p className="text-sm text-telegram-text">{description}</p>
        </WorkoutModal>
    )
}
