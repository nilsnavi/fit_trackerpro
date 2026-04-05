import { Archive, Trash2 } from 'lucide-react'
import { WorkoutModal } from './WorkoutModal'

interface TemplateActionsSheetProps {
    isOpen: boolean
    templateName: string | null
    isArchived: boolean
    onClose: () => void
    onArchive: () => void
    onUnarchive: () => void
    onDelete: () => void
}

export function TemplateActionsSheet({
    isOpen,
    templateName,
    isArchived,
    onClose,
    onArchive,
    onUnarchive,
    onDelete,
}: TemplateActionsSheetProps) {
    return (
        <WorkoutModal
            isOpen={isOpen}
            onClose={onClose}
            title={templateName ?? 'Действия с шаблоном'}
            description="Выберите действие для текущего шаблона тренировки."
            size="sm"
            bodyClassName="space-y-2"
        >
                <button
                    type="button"
                    onClick={isArchived ? onUnarchive : onArchive}
                    className="flex w-full items-center gap-2 rounded-xl bg-telegram-secondary-bg px-3 py-3 text-left text-sm font-medium text-telegram-text active:scale-[0.99]"
                >
                    <Archive className="h-4 w-4 text-telegram-hint" />
                    {isArchived ? 'Разархивировать' : 'Архивировать'}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex w-full items-center gap-2 rounded-xl bg-danger/10 px-3 py-3 text-left text-sm font-medium text-danger active:scale-[0.99]"
                >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                </button>
        </WorkoutModal>
    )
}
