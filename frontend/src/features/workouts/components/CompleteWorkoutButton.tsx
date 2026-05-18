/**
 * CompleteWorkoutButton Component
 * 
 * Кнопка завершения тренировки с подтверждением.
 * Pure UI component.
 */

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface CompleteWorkoutButtonProps {
    totalSetsCompleted: number
    totalDurationSeconds: number
    isCompleting?: boolean
    hasUncompletedSets?: boolean
    onComplete: () => void
    className?: string
}

export function CompleteWorkoutButton({
    totalSetsCompleted,
    totalDurationSeconds,
    isCompleting = false,
    hasUncompletedSets = false,
    onComplete,
    className,
}: CompleteWorkoutButtonProps) {
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        
        if (hours > 0) {
            return `${hours}ч ${minutes}м`
        }
        return `${minutes} мин`
    }

    return (
        <div className={cn('space-y-3', className)}>
            {/* Статистика перед завершением */}
            <div className="rounded-xl bg-telegram-secondary-bg p-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-telegram-hint">Выполнено подходов</p>
                        <p className="mt-1 text-xl font-bold text-telegram-text">
                            {totalSetsCompleted}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-telegram-hint">Длительность</p>
                        <p className="mt-1 text-xl font-bold text-telegram-text">
                            {formatDuration(totalDurationSeconds)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Предупреждение о незавершенных подходах */}
            {hasUncompletedSets && (
                <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-orange-500">
                            Есть незавершенные подходы
                        </p>
                        <p className="mt-0.5 text-xs text-orange-500/80">
                            Убедитесь, что все подходы отмечены правильно
                        </p>
                    </div>
                </div>
            )}

            {/* Кнопка завершения */}
            <button
                type="button"
                onClick={onComplete}
                disabled={isCompleting}
                className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold transition-all',
                    isCompleting
                        ? 'bg-telegram-bg text-telegram-hint cursor-not-allowed'
                        : 'bg-success text-white hover:bg-success/90 active:scale-[0.98]',
                )}
            >
                {isCompleting ? (
                    <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Завершение...
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="h-5 w-5" />
                        Завершить тренировку
                    </>
                )}
            </button>
        </div>
    )
}
