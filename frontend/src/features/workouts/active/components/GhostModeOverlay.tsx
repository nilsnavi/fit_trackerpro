import { memo } from 'react'
import { Ghost, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useGhostMode, useWorkoutSmartSettingsStore } from '@/stores/workoutSmartSettingsStore'
import { GhostSetRow } from './GhostSetRow'
import type { GhostModeSetData } from '../hooks/useGhostModeData'

export interface GhostModeOverlayProps {
    /** Данные Ghost Mode */
    ghostSet: GhostModeSetData | null
    /** Тип упражнения */
    exerciseType?: 'strength' | 'cardio' | 'time-based' | 'unknown'
    /** Показывать ли оверлей (если false, скрыт даже при наличии данных) */
    visible?: boolean
    /** Компактный режим (для inline отображения) */
    compact?: boolean
    /** Callback для отключения Ghost Mode */
    onDismiss?: () => void
    /** Дополнительные классы */
    className?: string
}

/**
 * Оверлей Ghost Mode — показывает предыдущие показатели упражнения.
 * Позволяет пользователю сравнить текущий подход с прошлым выполнением.
 */
export const GhostModeOverlay = memo(function GhostModeOverlay({
    ghostSet,
    exerciseType = 'strength',
    visible = true,
    compact = false,
    onDismiss,
    className,
}: GhostModeOverlayProps) {
    const ghostModeEnabled = useGhostMode()

    // Не показываем если Ghost Mode отключён или нет данных
    if (!ghostModeEnabled || !ghostSet || !visible) {
        return null
    }

    if (compact) {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-full bg-telegram-secondary-bg px-2 py-1',
                    className,
                )}
            >
                <Ghost className="h-3 w-3 text-telegram-hint" />
                <GhostSetRow ghost={ghostSet} exerciseType={exerciseType} compact />
            </div>
        )
    }

    return (
        <div
            className={cn(
                'relative rounded-xl border border-primary/20 bg-primary/5 p-3',
                className,
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Ghost className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Ghost Mode
                    </span>
                </div>
                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="rounded-full p-1 text-telegram-hint transition-colors hover:bg-telegram-secondary-bg hover:text-telegram-text"
                        aria-label="Скрыть Ghost Mode"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <div className="mt-2">
                <GhostSetRow ghost={ghostSet} exerciseType={exerciseType} />
            </div>
        </div>
    )
})

/**
 * Toggle кнопка для Ghost Mode в меню сессии.
 */
export const GhostModeToggle = memo(function GhostModeToggle({
    className,
}: {
    className?: string
}) {
    const ghostModeEnabled = useGhostMode()
    const toggleGhostMode = useWorkoutSmartSettingsStore((s) => s.toggleGhostMode)

    return (
        <button
            type="button"
            onClick={() => toggleGhostMode()}
            className={cn(
                'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                ghostModeEnabled
                    ? 'bg-primary/10 text-primary'
                    : 'text-telegram-text hover:bg-telegram-secondary-bg',
                className,
            )}
        >
            <div className="flex items-center gap-3">
                <Ghost className="h-4 w-4" />
                <span>Ghost Mode</span>
            </div>
            <div
                className={cn(
                    'h-5 w-9 rounded-full transition-colors',
                    ghostModeEnabled ? 'bg-primary' : 'bg-telegram-hint/30',
                )}
            >
                <div
                    className={cn(
                        'mt-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        ghostModeEnabled ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                />
            </div>
        </button>
    )
})
