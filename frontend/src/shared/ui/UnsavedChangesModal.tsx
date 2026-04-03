import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

interface UnsavedChangesModalProps {
    isOpen: boolean
    onLeave: () => void
    onStay: () => void
}

/**
 * Reusable confirmation dialog shown when a user tries to leave a page
 * or reset state that has unsaved changes.
 */
export function UnsavedChangesModal({ isOpen, onLeave, onStay }: UnsavedChangesModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onStay} title="Несохранённые изменения" size="sm">
            <div className="space-y-4">
                <p className="text-sm text-telegram-text">
                    У вас есть несохранённые изменения. Если выйти сейчас, они будут потеряны.
                </p>
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onStay}>
                        Остаться
                    </Button>
                    <Button variant="emergency" fullWidth onClick={onLeave}>
                        Выйти
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
