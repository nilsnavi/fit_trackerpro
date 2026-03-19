import { Dumbbell, Zap, Heart, Activity, Plus, ChevronRight } from 'lucide-react'
import { cn } from '@utils/cn'
import type { WorkoutTemplate } from '@stores/homeStore'

interface WorkoutCardProps {
    template: WorkoutTemplate
    onStart: (id: string) => void
    onClick?: (id: string) => void
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

export function WorkoutCard({ template, onStart, onClick }: WorkoutCardProps) {
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
            <div className="flex items-start justify-between">
                <div className={cn(
                    'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
                    template.color
                )}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-telegram-hint bg-telegram-bg px-2 py-1 rounded-full">
                    {typeLabels[template.type]}
                </span>
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
