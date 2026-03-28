import { forwardRef, HTMLAttributes, useEffect, useState } from 'react';
import { cn } from '@shared/lib/cn';

export type ProgressColor = 'primary' | 'success' | 'warning' | 'danger' | 'gradient';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
    /** Текущее значение */
    value: number;
    /** Максимальное значение */
    max?: number;
    /** Цвет прогресса */
    color?: ProgressColor;
    /** Показывать процент */
    showLabel?: boolean;
    /** Анимированное заполнение */
    animated?: boolean;
    /** Размер */
    size?: 'sm' | 'md' | 'lg';
    /** Формат лейбла */
    labelFormat?: 'percent' | 'value' | 'fraction';
    /** Пользовательский лейбл */
    customLabel?: string;
    /** Haptic feedback при достижении 100% */
    hapticOnComplete?: boolean;
}

const colorStyles: Record<ProgressColor, string> = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    gradient: 'bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600',
};

const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
};

const labelSizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
};

/**
 * ProgressBar - компонент индикатора прогресса
 * 
 * @example
 * // Базовый прогресс
 * <ProgressBar value={75} />
 * 
 * // С градиентом и процентом
 * <ProgressBar 
 *   value={60} 
 *   color="gradient" 
 *   showLabel 
 *   animated 
 * />
 * 
 * // Цвет в зависимости от значения
 * <ProgressBar 
 *   value={90} 
 *   color={value > 80 ? 'success' : 'warning'}
 *   max={100}
 *   labelFormat="fraction"
 * />
 * 
 * // Тренировочный прогресс
 * <ProgressBar 
 *   value={completedExercises} 
 *   max={totalExercises}
 *   size="lg"
 *   showLabel
 *   labelFormat="fraction"
 * />
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
    (
        {
            value,
            max = 100,
            color = 'primary',
            showLabel = false,
            animated = false,
            size = 'md',
            labelFormat = 'percent',
            customLabel,
            hapticOnComplete = true,
            className,
            ...props
        },
        ref
    ) => {
        const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
        const [hasCompleted, setHasCompleted] = useState(false);

        // Вычисляем процент
        const percentage = Math.min(100, Math.max(0, (value / max) * 100));
        const displayPercentage = Math.min(100, Math.max(0, (displayValue / max) * 100));

        // Анимация заполнения
        useEffect(() => {
            if (!animated) {
                setDisplayValue(value);
                return;
            }

            const duration = 800; // ms
            const startTime = Date.now();
            const startValue = displayValue;
            const endValue = value;

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);

                // Easing function (ease-out-cubic)
                const easeOut = 1 - Math.pow(1 - progress, 3);

                const currentValue = startValue + (endValue - startValue) * easeOut;
                setDisplayValue(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        }, [value, animated, displayValue]);

        // Haptic feedback при достижении 100%
        useEffect(() => {
            if (
                hapticOnComplete &&
                percentage >= 100 &&
                !hasCompleted &&
                typeof window !== 'undefined' &&
                'Telegram' in window
            ) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
                setHasCompleted(true);
            }

            if (percentage < 100) {
                setHasCompleted(false);
            }
        }, [percentage, hasCompleted, hapticOnComplete]);

        // Форматируем лейбл
        const getLabel = () => {
            if (customLabel) return customLabel;

            switch (labelFormat) {
                case 'percent':
                    return `${Math.round(percentage)}%`;
                case 'value':
                    return `${Math.round(value)}`;
                case 'fraction':
                    return `${Math.round(value)} / ${max}`;
                default:
                    return `${Math.round(percentage)}%`;
            }
        };

        return (
            <div
                ref={ref}
                className={cn('w-full', className)}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={showLabel ? getLabel() : undefined}
                {...props}
            >
                {/* Контейнер с лейблом */}
                <div
                    className={cn(
                        'flex items-center gap-3',
                        showLabel && 'justify-between'
                    )}
                >
                    {/* Прогресс бар */}
                    <div
                        className={cn(
                            'flex-1 bg-telegram-secondary-bg rounded-full overflow-hidden',
                            sizeStyles[size]
                        )}
                    >
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-300 ease-out',
                                colorStyles[color],
                                animated && 'transition-all duration-100'
                            )}
                            style={{ width: `${displayPercentage}%` }}
                        />
                    </div>

                    {/* Лейбл */}
                    {showLabel && (
                        <span
                            className={cn(
                                'font-medium text-telegram-text flex-shrink-0 tabular-nums',
                                labelSizeStyles[size]
                            )}
                        >
                            {getLabel()}
                        </span>
                    )}
                </div>
            </div>
        );
    }
);

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
