import { Copy, Globe, LayoutTemplate, Lock, MoreVertical, Pencil, Pin, Play, Dumbbell, Heart } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import type { BackendWorkoutType, WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'
import { cn } from '@shared/lib/cn'

const TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

const EXERCISE_ICON_MAP = {
    strength: Dumbbell,
    cardio: Heart,
} as const

export interface WorkoutTemplateCardProps {
    template: WorkoutTemplateResponse
    onOpenDetails: (id: number) => void
    isPinned: boolean
    isPinLimitReached: boolean
    pinFeedbackMessage: string | null
    isStarting: boolean
    isDeleting: boolean
    isDuplicating: boolean
    onStart: (id: number, name: string) => void
    onEdit: (id: number) => void
    onDuplicate: (id: number) => void
    onOpenActions: (id: number, name: string, isArchived: boolean) => void
    onTogglePin: (id: number) => void
}

export function WorkoutTemplateCard({
    template,
    onOpenDetails,
    isPinned,
    isPinLimitReached,
    pinFeedbackMessage,
    isStarting,
    isDeleting,
    isDuplicating,
    onStart,
    onEdit,
    onDuplicate,
    onOpenActions,
    onTogglePin,
}: WorkoutTemplateCardProps) {
    const durationMinutes = estimateTemplateDurationMinutes(template)
    const exerciseWord =
        template.exercises.length === 1
            ? 'упражнение'
            : template.exercises.length < 5
              ? 'упражнения'
              : 'упражнений'

    return (
        <div className="rounded-2xl bg-telegram-secondary-bg p-4 transition-colors">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <LayoutTemplate className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => onOpenDetails(template.id)}
                                className="max-w-full text-left"
                                aria-label={`Открыть шаблон ${template.name}`}
                            >
                                <h3 className="truncate text-sm font-semibold leading-snug text-telegram-text underline-offset-2 hover:underline">
                                    {template.name}
                                </h3>
                            </button>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-telegram-hint">
                                {template.is_archived && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Архив</span>
                                )}
                                <span className="rounded-full bg-telegram-bg px-2 py-0.5">{TYPE_LABEL[template.type]}</span>
                                <span className="rounded-full bg-telegram-bg px-2 py-0.5">{template.exercises.length} {exerciseWord}</span>
                                <span className="rounded-full bg-telegram-bg px-2 py-0.5">~{durationMinutes} мин</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-telegram-bg px-2 py-0.5">
                                    {template.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                    {template.is_public ? 'Публичный' : 'Приватный'}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={!isPinned && isPinLimitReached}
                            onClick={() => onTogglePin(template.id)}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
                                isPinned ? 'bg-primary/15 text-primary' : 'bg-telegram-bg text-telegram-hint'
                            } disabled:opacity-40`}
                            aria-label={
                                isPinned
                                    ? `Убрать шаблон ${template.name} из избранного`
                                    : isPinLimitReached
                                      ? 'Лимит избранных шаблонов'
                                      : `Добавить ${template.name} в избранное`
                            }
                        >
                            <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    {pinFeedbackMessage ? (
                        <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {pinFeedbackMessage}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Quick exercise preview */}
            {template.exercises.length > 0 && (
                <div className="mt-3 space-y-1 rounded-lg bg-telegram-bg/40 p-3">
                    {template.exercises.slice(0, 2).map((exercise, idx) => {
                        const parts: string[] = []
                        if (exercise.sets) parts.push(`${exercise.sets}×`)
                        if (exercise.reps) parts.push(`${exercise.reps}повт`)
                        if (exercise.duration) parts.push(`${exercise.duration}м`)
                        if (exercise.weight) parts.push(`${exercise.weight}кг`)
                        
                        return (
                            <div key={idx} className="flex items-start gap-2">
                                <div className="text-[10px] font-bold text-telegram-hint mt-0.5">
                                    {idx + 1}.
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-telegram-text truncate">
                                        {exercise.name}
                                    </p>
                                    {parts.length > 0 && (
                                        <p className="text-[9px] text-telegram-hint">
                                            {parts.join(' ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {template.exercises.length > 2 && (
                        <p className="text-[10px] text-telegram-hint pt-1">
                            +{template.exercises.length - 2} ещё
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={isStarting || template.is_archived}
                    onClick={() => onStart(template.id, template.name)}
                    leftIcon={<Play className="h-4 w-4" fill="currentColor" />}
                    className="col-span-3"
                >
                    Начать по шаблону
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={template.is_archived}
                    onClick={() => onEdit(template.id)}
                    leftIcon={<Pencil className="h-4 w-4" />}
                >
                    Править
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={isDuplicating}
                    onClick={() => onDuplicate(template.id)}
                    leftIcon={<Copy className="h-4 w-4" />}
                >
                    Копия
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={isDeleting}
                    onClick={() => onOpenActions(template.id, template.name, template.is_archived)}
                    leftIcon={<MoreVertical className="h-4 w-4" />}
                >
                    Ещё
                </Button>
            </div>
        </div>
    )
}
