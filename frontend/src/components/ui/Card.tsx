import React, { forwardRef, ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export type CardVariant = 'workout' | 'exercise' | 'stats' | 'info';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    /** Вариант карточки */
    variant?: CardVariant;
    /** Заголовок карточки */
    title?: string;
    /** Подзаголовок */
    subtitle?: string;
    /** Дочерние элементы */
    children: ReactNode;
    /** Обработчик клика */
    onClick?: () => void;
    /** Отключить hover эффекты */
    disableHover?: boolean;
    /** Haptic feedback при нажатии */
    haptic?: 'light' | 'medium' | 'heavy' | false;
}

const variantStyles: Record<CardVariant, string> = {
    workout: cn(
        'bg-telegram-secondary-bg',
        'shadow-sm hover:shadow-md',
        'border-transparent'
    ),
    exercise: cn(
        'bg-telegram-bg',
        'border border-border',
        'hover:border-primary-300 dark:hover:border-primary-700'
    ),
    stats: cn(
        'bg-gradient-to-br from-primary-500 to-primary-600',
        'text-white shadow-primary'
    ),
    info: cn(
        'bg-telegram-bg',
        'border border-border',
        'shadow-sm'
    ),
};

const variantPadding: Record<CardVariant, string> = {
    workout: 'p-4',
    exercise: 'p-3',
    stats: 'p-5',
    info: 'p-4',
};

/**
 * Card - компонент карточки с различными вариантами
 * 
 * @example
 * // Workout карточка
 * <Card variant="workout" title="Тренировка" subtitle="Сегодня, 18:00">
 *   <p>Силовая тренировка</p>
 * </Card>
 * 
 * // Stats карточка с градиентом
 * <Card variant="stats" title="Калории" subtitle="Сожжено сегодня">
 *   <span className="text-3xl font-bold">450</span>
 * </Card>
 * 
 * // Кликабельная карточка
 * <Card variant="exercise" onClick={handleClick} title="Приседания">
 *   <p>3 подхода × 12 повторений</p>
 * </Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            children,
            variant = 'info',
            title,
            subtitle,
            onClick,
            disableHover = false,
            haptic = 'light',
            className,
            ...props
        },
        ref
    ) => {
        const handleClick = () => {
            // Haptic feedback для мобильных устройств
            if (haptic && onClick && typeof window !== 'undefined' && 'Telegram' in window) {
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred(haptic);
                }
            }
            onClick?.();
        };

        const isClickable = !!onClick;
        const isStats = variant === 'stats';

        return (
            <div
                ref={ref}
                onClick={handleClick}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                    isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleClick();
                            }
                        }
                        : undefined
                }
                className={cn(
                    // Базовые стили
                    'rounded-2xl',
                    'transition-all duration-200',
                    'touch-manipulation',

                    // Варианты
                    variantStyles[variant],
                    variantPadding[variant],

                    // Hover эффекты для кликабельных
                    isClickable && !disableHover && 'cursor-pointer active:scale-[0.98]',

                    // Hover для некликабельных
                    !isClickable && !disableHover && variant !== 'stats' && 'hover:shadow-sm',

                    // Фокус
                    isClickable && 'focus:outline-none focus:ring-2 focus:ring-primary/30',

                    className
                )}
                {...props}
            >
                {/* Заголовок */}
                {(title || subtitle) && (
                    <div className={cn('mb-3', isStats && 'text-white/90')}>
                        {title && (
                            <h3
                                className={cn(
                                    'font-semibold text-base',
                                    isStats ? 'text-white' : 'text-telegram-text'
                                )}
                            >
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p
                                className={cn(
                                    'text-sm mt-0.5',
                                    isStats ? 'text-white/80' : 'text-telegram-hint'
                                )}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}

                {/* Контент */}
                <div className={cn(isStats && 'text-white')}>{children}</div>
            </div>
        );
    }
);

Card.displayName = 'Card';

export default Card;
