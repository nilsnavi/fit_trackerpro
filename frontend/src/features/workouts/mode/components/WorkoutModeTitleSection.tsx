/**
 * Title + collapsible description editor for WorkoutModePage.
 */
import type { WorkoutModeEditorValidationErrors } from '@features/workouts/workoutMode/workoutModeEditorTypes'
import { Input } from '@shared/ui/Input'

interface WorkoutModeTitleSectionProps {
    containerId?: string
    title: string
    description: string
    descOpen: boolean
    validationErrors: WorkoutModeEditorValidationErrors
    onTitleChange: (value: string) => void
    onDescriptionChange: (value: string) => void
    onToggleDesc: () => void
}

export function WorkoutModeTitleSection({
    containerId,
    title,
    description,
    descOpen,
    validationErrors,
    onTitleChange,
    onDescriptionChange,
    onToggleDesc,
}: WorkoutModeTitleSectionProps) {
    return (
        <div id={containerId} data-invalid={Boolean(validationErrors.title)} className="space-y-2">
            <Input
                id="workout-mode-title-input"
                label="Название тренировки"
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                error={validationErrors.title}
                fullWidth
                placeholder="Например: Силовая • 4 круга"
            />
            <button
                type="button"
                onClick={onToggleDesc}
                className="flex items-center gap-1 text-xs text-telegram-hint hover:text-telegram-text transition-colors"
            >
                <span>{descOpen ? 'Скрыть описание' : 'Добавить описание'}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${descOpen ? 'rotate-180' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {descOpen && (
                <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="Описание тренировки (необязательно)"
                    className="w-full rounded-xl border border-border bg-telegram-secondary-bg px-3 py-2.5 text-sm text-telegram-text placeholder-telegram-hint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
            )}
        </div>
    )
}
