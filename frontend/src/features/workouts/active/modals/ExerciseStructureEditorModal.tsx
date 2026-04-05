import { WorkoutModal } from '@features/workouts/components/WorkoutModal'
import type { StructureEditorState } from '@features/workouts/active/hooks/useWorkoutStructureEditor'

interface ExerciseStructureEditorModalProps {
    editorState: StructureEditorState
    isOpen: boolean
    onClose: () => void
    onChange: (next: StructureEditorState) => void
    onSave: () => void
}

export function ExerciseStructureEditorModal({
    editorState,
    isOpen,
    onClose,
    onChange,
    onSave,
}: ExerciseStructureEditorModalProps) {
    return (
        <WorkoutModal
            isOpen={isOpen}
            onClose={onClose}
            title="Изменить структуру упражнения"
            description="Обновите рабочие параметры для выбранного упражнения в текущей сессии."
            size="md"
            bodyClassName="space-y-4"
            secondaryAction={{
                label: 'Отмена',
                onClick: onClose,
                variant: 'secondary',
            }}
            primaryAction={{
                label: 'Сохранить структуру',
                onClick: onSave,
            }}
        >
                <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium text-telegram-text">
                        Подходы
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={editorState?.sets ?? '1'}
                            onChange={(e) => {
                                if (!editorState) return
                                onChange({ ...editorState, sets: e.target.value })
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                    <label className="text-sm font-medium text-telegram-text">
                        Повторы
                        <input
                            type="number"
                            min={0}
                            value={editorState?.reps ?? ''}
                            onChange={(e) => {
                                if (!editorState) return
                                onChange({ ...editorState, reps: e.target.value })
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                    <label className="text-sm font-medium text-telegram-text">
                        Вес (кг)
                        <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={editorState?.weight ?? ''}
                            onChange={(e) => {
                                if (!editorState) return
                                onChange({ ...editorState, weight: e.target.value })
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                    <label className="text-sm font-medium text-telegram-text">
                        Длительность (сек)
                        <input
                            type="number"
                            min={0}
                            value={editorState?.duration ?? ''}
                            onChange={(e) => {
                                if (!editorState) return
                                onChange({ ...editorState, duration: e.target.value })
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                </div>

        </WorkoutModal>
    )
}
