import { memo } from 'react'
import { cn } from '@shared/lib/cn'

export interface RpeInputControlProps {
    /** Текущее значение RPE */
    value?: number
    /** Callback при выборе RPE */
    onChange: (value: number | undefined) => void
    /** Вариант отображения */
    variant?: 'chips' | 'segmented' | 'compact'
    /** Показать label */
    showLabel?: boolean
    /** Компактный размер */
    size?: 'sm' | 'md'
    /** Disabled */
    disabled?: boolean
    /** Дополнительные классы */
    className?: string
}

const RPE_OPTIONS = [6, 7, 8, 9, 10]

/**
 * Mobile-friendly RPE input control.
 * 
 * Варианты:
 * - chips: кнопки 6-10 в ряд (по умолчанию)
 * - segmented: сегментированный контроль
 * - compact: компактные кнопки
 * 
 * При повторном клике на выбранное значение - сбрасывает (undefined).
 */
export const RpeInputControl = memo(function RpeInputControl({
    value,
    onChange,
    variant = 'chips',
    showLabel = true,
    size = 'md',
    disabled = false,
    className,
}: RpeInputControlProps) {
    const handleToggle = (rpe: number) => {
        if (disabled) return
        // Toggle: если выбрано то же значение - сбросить
        onChange(value === rpe ? undefined : rpe)
    }

    const sizeClasses = size === 'sm'
        ? 'min-h-9 min-w-9 text-xs'
        : 'min-h-11 min-w-11 text-sm'

    // Chips variant (default)
    if (variant === 'chips') {
        return (
            <div className={cn('flex flex-wrap items-center gap-2', className)}>
                {showLabel && (
                    <span className="shrink-0 text-[11px] font-medium text-telegram-hint">
                        RPE
                    </span>
                )}
                {RPE_OPTIONS.map((rpe) => (
                    <button
                        key={rpe}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleToggle(rpe)}
                        className={cn(
                            'touch-manipulation rounded-xl font-semibold transition-colors',
                            sizeClasses,
                            value === rpe
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg',
                            disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label={`RPE ${rpe}`}
                        aria-pressed={value === rpe}
                    >
                        {rpe}
                    </button>
                ))}
            </div>
        )
    }

    // Segmented variant
    if (variant === 'segmented') {
        return (
            <div className={cn('flex flex-col gap-1.5', className)}>
                {showLabel && (
                    <span className="text-[11px] font-medium text-telegram-hint">
                        RPE (усилие)
                    </span>
                )}
                <div className="flex rounded-xl bg-telegram-bg p-1">
                    {RPE_OPTIONS.map((rpe) => (
                        <button
                            key={rpe}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleToggle(rpe)}
                            className={cn(
                                'flex-1 touch-manipulation rounded-lg py-2 text-sm font-semibold transition-colors',
                                value === rpe
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-telegram-hint active:bg-telegram-secondary-bg',
                                disabled && 'opacity-50 cursor-not-allowed'
                            )}
                            aria-label={`RPE ${rpe}`}
                            aria-pressed={value === rpe}
                        >
                            {rpe}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Compact variant
    return (
        <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
            {showLabel && (
                <span className="text-[11px] text-telegram-hint">RPE</span>
            )}
            {RPE_OPTIONS.map((rpe) => (
                <button
                    key={rpe}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleToggle(rpe)}
                    className={cn(
                        'min-h-8 min-w-8 touch-manipulation rounded-lg text-xs font-medium transition-colors',
                        value === rpe
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-label={`RPE ${rpe}`}
                    aria-pressed={value === rpe}
                >
                    {rpe}
                </button>
            ))}
        </div>
    )
})

RpeInputControl.displayName = 'RpeInputControl'
