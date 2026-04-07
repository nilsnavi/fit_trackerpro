import { useMemo } from 'react'
import { Play, Clock, Dumbbell, Heart, Zap } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'

interface RecentTemplatesSectionProps {
    templates: WorkoutTemplateResponse[]
    isLoading?: boolean
    onStart: (id: number, name: string) => void
    onOpenDetails: (id: number) => void
    isStarting?: boolean
    startingId?: number | null
}

const TYPE_ICON: Record<string, React.ReactNode> = {
    strength: <Dumbbell className="h-4 w-4" />,
    cardio: <Heart className="h-4 w-4" />,
    flexibility: <Zap className="h-4 w-4" />,
    mixed: <Dumbbell className="h-4 w-4" />,
}

const TYPE_COLOR: Record<string, string> = {
    strength: 'bg-blue-100/10 text-blue-500',
    cardio: 'bg-red-100/10 text-red-500',
    flexibility: 'bg-purple-100/10 text-purple-500',
    mixed: 'bg-amber-100/10 text-amber-600',
}

export function RecentTemplatesSection({
    templates,
    isLoading = false,
    onStart,
    onOpenDetails,
    isStarting = false,
    startingId = null,
}: RecentTemplatesSectionProps) {
    const topTemplates = useMemo(() => templates.slice(0, 3), [templates])

    if (templates.length === 0) return null

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-telegram-secondary-bg" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 pb-1">
                <Clock className="h-4 w-4 text-telegram-hint" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-telegram-hint">Последние</h3>
            </div>
            <div className="space-y-1.5">
                {topTemplates.map((template) => {
                    const duration = estimateTemplateDurationMinutes(template)
                    const isStartingThis = isStarting && startingId === template.id
                    const exerciseCount = template.exercises.length

                    return (
                        <div
                            key={template.id}
                            className={cn(
                                'tg-card group flex items-center justify-between gap-3 p-3',
                                'transition-all duration-200',
                                isStartingThis && 'opacity-60',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => onOpenDetails(template.id)}
                                className="flex-1 min-w-0 text-left"
                                disabled={isStarting}
                                aria-label={`Открыть ${template.name}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                            TYPE_COLOR[template.type] || TYPE_COLOR.mixed,
                                        )}
                                    >
                                        {TYPE_ICON[template.type] || TYPE_ICON.mixed}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-telegram-text">
                                            {template.name}
                                        </p>
                                        <p className="truncate text-[11px] text-telegram-hint">
                                            {exerciseCount} упр. • ~{duration} мин
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => onStart(template.id, template.name)}
                                disabled={isStarting}
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                    'transition-all duration-200 active:scale-90',
                                    isStartingThis
                                        ? 'bg-primary/30 text-primary'
                                        : 'bg-primary/15 text-primary group-hover:bg-primary/25',
                                )}
                                aria-label={`Начать тренировку ${template.name}`}
                            >
                                {isStartingThis ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                ) : (
                                    <Play className="h-4 w-4 fill-current" />
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
