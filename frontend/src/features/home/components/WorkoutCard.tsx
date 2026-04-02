import { Dumbbell, Zap, Heart, Activity, Plus, ChevronRight, Pin } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { HomeWorkoutTemplate } from '@shared/types'

interface WorkoutCardProps {
    template: HomeWorkoutTemplate
    onStart: (id: string) => void
    onClick?: (id: string) => void
    isPinned?: boolean
    isPinDisabled?: boolean
    onToggleFavorite?: (id: string) => void
}

const iconMap = {
    dumbbell: Dumbbell,
    zap: Zap,
    heart: Heart,
    activity: Activity,
    plus: Plus
}

const typeLabels: Record<string, string> = {
    strength: 'Силовая',
    cardio: 'Кардио',
    yoga: 'Йога',
    functional: 'Функционал',
    custom: 'Своя'
}

export function WorkoutCard({
    template,
    onStart,
    onClick,
    isPinned = false,
    isPinDisabled = false,
    onToggleFavorite,
}: WorkoutCardProps) {
    const Icon = iconMap[template.icon as keyof typeof iconMap] || Dumbbell
    const isCustom = template.type === 'custom'

    return (
        <div
            onClick={() => onClick?.(template.id)}
            className={cn(
                'bg-telegram-secondary-bg rounded-2xl p-4 transition-all duration-200',
                'active:scale-95 cursor-pointer',
                'flex flex-col gap-3'
            )}
        >
            {/* Header with icon and type */}
            <div className="flex items-start justify-between gap-2">
                <div className={cn(
                    'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
                    template.color
                )}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                    {!isCustom && onToggleFavorite && (
                        <button
                            type="button"
                            disabled={isPinDisabled}
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleFavorite(template.id)
                            }}
                            className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50',
                                isPinned ? 'bg-primary/15 text-primary' : 'bg-telegram-bg text-telegram-hint',
                            )}
                            aria-label={isPinned ? `Убрать ${template.name} из избранного` : `Добавить ${template.name} в избранное`}
                        >
                            <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-current')} />
                        </button>
                    )}
                    <span className="text-xs text-telegram-hint bg-telegram-bg px-2 py-1 rounded-full">
                        {typeLabels[template.type]}
                    </span>
                </div>
            </div>

            {/* Title */}
            <div>
                <h3 className="font-semibold text-telegram-text">{template.name}</h3>
                {!isCustom && (
                    <p className="text-sm text-telegram-hint">
                        {template.exerciseCount} упражнений
                    </p>
                )}
            </div>

            {/* Last workout info */}
            {!isCustom && template.lastWorkout && (
                <p className="text-xs text-telegram-hint">
                    Последняя: {template.lastWorkout}
                </p>
            )}

            {/* Start button */}
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onStart(template.id)
                }}
                className={cn(
                    'w-full py-2.5 rounded-xl font-medium text-sm',
                    'flex items-center justify-center gap-2',
                    'transition-all duration-200 active:scale-95',
                    isCustom
                        ? 'bg-telegram-bg text-telegram-text border border-border hover:bg-telegram-secondary-bg'
                        : 'bg-telegram-button text-telegram-button-text hover:opacity-90'
                )}
            >
                {isCustom ? (
                    <>
                        <Plus className="w-4 h-4" />
                        Создать
                    </>
                ) : (
                    <>
                        Начать
                        <ChevronRight className="w-4 h-4" />
                    </>
                )}
            </button>
        </div>
    )
}
