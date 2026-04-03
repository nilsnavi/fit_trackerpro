import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

interface UnsavedChangesModalProps {
    isOpen: boolean
    onLeave: () => void
    onStay: () => void
    title?: string
    description?: string
    leaveLabel?: string
    stayLabel?: string
    actionOrder?: 'stay-first' | 'leave-first'
}

/**
 * Reusable confirmation dialog shown when a user tries to leave a page
 * or reset state that has unsaved changes.
 */
export function UnsavedChangesModal({
    isOpen,
    onLeave,
    onStay,
    title = 'Несохранённые изменения',
    description = 'У вас есть несохранённые изменения. Если выйти сейчас, они будут потеряны.',
    leaveLabel = 'Выйти',
    stayLabel = 'Остаться',
    actionOrder = 'stay-first',
}: UnsavedChangesModalProps) {
    const stayButton = (
        <Button key="stay" variant="secondary" fullWidth onClick={onStay}>
            {stayLabel}
        </Button>
    )

    const leaveButton = (
        <Button key="leave" variant="emergency" fullWidth onClick={onLeave}>
            {leaveLabel}
        </Button>
    )

    const actions = actionOrder === 'leave-first'
        ? [leaveButton, stayButton]
        : [stayButton, leaveButton]

    return (
        <Modal isOpen={isOpen} onClose={onStay} title={title} size="sm">
            <div className="space-y-4">
                {description ? (
                    <p className="text-sm text-telegram-text">
                        {description}
                    </p>
                ) : null}
                <div className="flex gap-2">{actions}</div>
            </div>
        </Modal>
    )
}
