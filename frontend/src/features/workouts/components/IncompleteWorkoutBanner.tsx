/**
 * IncompleteWorkoutBanner Component
 * 
 * Баннер для уведомления о незавершенной тренировке.
 * Показывает опции "Продолжить" или "Начать заново".
 */

import { AlertTriangle, Play, Trash2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface IncompleteWorkoutBannerProps {
    workoutName: string
    startedAt: string
    onContinue: () => void
    onDiscard: () => void
    className?: string
}

export function IncompleteWorkoutBanner({
    workoutName,
    startedAt,
    onContinue,
    onDiscard,
    className,
}: IncompleteWorkoutBannerProps) {
    const timeAgo = formatDistanceToNow(new Date(startedAt), {
        addSuffix: true,
        locale: ru,
    })

    return (
        <div
            className={cn(
                'rounded-xl border border-orange-500/20 bg-orange-500/10 p-4',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                {/* Иконка предупреждения */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>

                {/* Контент */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-telegram-text">
                        Незавершенная тренировка
                    </h3>
                    <p className="mt-1 text-xs text-telegram-hint">
                        {workoutName} • {timeAgo}
                    </p>

                    {/* Кнопки действий */}
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={onContinue}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                        >
                            <Play className="h-3.5 w-3.5" />
                            Продолжить
                        </button>
                        <button
                            type="button"
                            onClick={onDiscard}
                            className="flex items-center justify-center gap-2 rounded-lg bg-telegram-secondary-bg px-3 py-2 text-xs font-medium text-telegram-hint transition-colors hover:bg-telegram-bg hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
