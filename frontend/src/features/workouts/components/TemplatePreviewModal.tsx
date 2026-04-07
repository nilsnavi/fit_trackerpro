import { AlertCircle, Dumbbell, Heart, Timer, Clock } from 'lucide-react'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'
import type { WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'
import { cn } from '@shared/lib/cn'

interface TemplatePreviewModalProps {
    isOpen: boolean
    template: WorkoutTemplateResponse | null
    isLoading?: boolean
    onClose: () => void
    onStart: (templateId: number, name: string) => void
    isStarting?: boolean
}

const EXERCISE_ICON_MAP = {
    strength: Dumbbell,
    cardio: Heart,
    timer: Timer,
} as const

export function TemplatePreviewModal({
    isOpen,
    template,
    isLoading = false,
    onClose,
    onStart,
    isStarting = false,
}: TemplatePreviewModalProps) {
    if (!template || !isOpen) return null

    const duration = estimateTemplateDurationMinutes(template)
    const exerciseCount = template.exercises.length

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={template.name}
            description={`${exerciseCount} упражнений • ~${duration} минут`}
            size="md"
        >
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {template.exercises.length === 0 ? (
                    <div className="rounded-lg bg-telegram-secondary-bg p-4 text-center">
                        <AlertCircle className="mx-auto h-6 w-6 text-telegram-hint mb-2" />
                        <p className="text-sm text-telegram-text">В этом шаблоне нет упражнений</p>
                    </div>
                ) : (
                    template.exercises.map((exercise, index) => {
                        const details: string[] = []
                        if (exercise.sets) details.push(`${exercise.sets}×`)
                        if (exercise.reps) details.push(`${exercise.reps} повт`)
                        if (exercise.duration) details.push(`${exercise.duration} мин`)
                        if (exercise.weight) details.push(`${exercise.weight} кг`)
                        if (exercise.rest_seconds)
                            details.push(`отдых ${Math.round(exercise.rest_seconds / 60)}м`)

                        return (
                            <div
                                key={`${index}-${exercise.name}`}
                                className="tg-card flex items-start gap-3 p-3"
                            >
                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-telegram-text truncate">
                                        {exercise.name}
                                    </h4>
                                    {details.length > 0 && (
                                        <p className="mt-1 text-xs text-telegram-hint">
                                            {details.join(' • ')}
                                        </p>
                                    )}
                                    {exercise.notes && (
                                        <p className="mt-1.5 text-[11px] text-telegram-hint italic">
                                            {exercise.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="mt-4 flex gap-2 pt-4 border-t border-telegram-secondary-bg">
                <Button
                    onClick={onClose}
                    variant="secondary"
                    className="flex-1"
                    disabled={isStarting}
                >
                    Закрыть
                </Button>
                <Button
                    onClick={() => {
                        onStart(template.id, template.name)
                    }}
                    disabled={isStarting || template.exercises.length === 0}
                    className="flex-1"
                >
                    {isStarting ? 'Загрузка...' : 'Начать'}
                </Button>
            </div>
        </Modal>
    )
}
