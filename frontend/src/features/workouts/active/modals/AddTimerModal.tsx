import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'

interface AddTimerModalProps {
    isOpen: boolean
    name: string
    duration: string
    notes: string
    onClose: () => void
    onChangeName: (value: string) => void
    onChangeDuration: (value: string) => void
    onChangeNotes: (value: string) => void
    onSubmit: () => void
}

export function AddTimerModal({
    isOpen,
    name,
    duration,
    notes,
    onClose,
    onChangeName,
    onChangeDuration,
    onChangeNotes,
    onSubmit,
}: AddTimerModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить таймер" size="md">
            <div className="space-y-4">
                <label className="block text-sm font-medium text-telegram-text">
                    Название
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => onChangeName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        placeholder="Например, Таймер отдыха"
                    />
                </label>

                <label className="block text-sm font-medium text-telegram-text">
                    Длительность (сек)
                    <input
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => onChangeDuration(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        placeholder="60"
                    />
                </label>

                <label className="block text-sm font-medium text-telegram-text">
                    Заметки
                    <textarea
                        value={notes}
                        onChange={(e) => onChangeNotes(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                    />
                </label>

                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose}>
                        Отмена
                    </Button>
                    <Button fullWidth onClick={onSubmit}>
                        Добавить
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
