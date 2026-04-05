import { Copy, Globe, LayoutTemplate, Lock, MoreVertical, Pencil, Pin, Play } from 'lucide-react'
import type { BackendWorkoutType, WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'

const TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

export interface WorkoutTemplateCardProps {
    template: WorkoutTemplateResponse
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
        <div className="bg-telegram-secondary-bg flex items-start gap-3 rounded-xl p-3 transition-colors">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LayoutTemplate className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-medium text-sm text-telegram-text leading-snug truncate">{template.name}</h3>
                    {pinFeedbackMessage && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {pinFeedbackMessage}
                        </span>
                    )}
                </div>
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
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                <button
                    type="button"
                    disabled={!isPinned && isPinLimitReached}
                    onClick={() => onTogglePin(template.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 ${
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
                <button
                    type="button"
                    disabled={template.is_archived}
                    onClick={() => onEdit(template.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95 disabled:opacity-50"
                    aria-label={`Редактировать шаблон ${template.name}`}
                >
                    <Pencil className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    disabled={isDuplicating}
                    onClick={() => onDuplicate(template.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95 disabled:opacity-60"
                    aria-label={`Дублировать шаблон ${template.name}`}
                >
                    <Copy className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onOpenActions(template.id, template.name, template.is_archived)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95 disabled:opacity-60"
                    aria-label={`Действия для шаблона ${template.name}`}
                >
                    <MoreVertical className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    disabled={isStarting || template.is_archived}
                    onClick={() => onStart(template.id, template.name)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95 disabled:opacity-60"
                    aria-label={`Начать по шаблону ${template.name}`}
                >
                    <Play className="h-4 w-4" fill="currentColor" />
                </button>
            </div>
        </div>
    )
}
