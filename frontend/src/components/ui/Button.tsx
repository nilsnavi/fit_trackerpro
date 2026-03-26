import React, { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'emergency' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Вариант кнопки */
    variant?: ButtonVariant;
    /** Размер кнопки */
    size?: ButtonSize;
    /** Состояние загрузки */
    isLoading?: boolean;
    /** Иконка слева от текста */
    leftIcon?: ReactNode;
    /** Иконка справа от текста */
    rightIcon?: ReactNode;
    /** Полная ширина */
    fullWidth?: boolean;
    /** Haptic feedback при нажатии (для Telegram Mini App) */
    haptic?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | false;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: cn(
        'bg-primary text-primary-foreground',
        'hover:bg-primary-600',
        'shadow-primary hover:shadow-lg',
        'focus:ring-2 focus:ring-primary/30'
    ),
    secondary: cn(
        'bg-telegram-secondary-bg text-telegram-text',
        'hover:bg-neutral-200 dark:hover:bg-neutral-700',
        'focus:ring-2 focus:ring-neutral-400/30'
    ),
    tertiary: cn(
        'bg-transparent text-primary border-2 border-primary',
        'hover:bg-primary-50 dark:hover:bg-primary-900/20',
        'focus:ring-2 focus:ring-primary/30'
    ),
    emergency: cn(
        'bg-danger text-danger-foreground',
        'hover:bg-danger-600',
        'shadow-danger hover:shadow-lg',
        'focus:ring-2 focus:ring-danger/30'
    ),
    ghost: cn(
        'bg-transparent text-telegram-text',
        'hover:bg-telegram-secondary-bg',
        'focus:ring-2 focus:ring-neutral-400/30'
    ),
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-sm gap-1.5',
    md: 'h-11 px-4 text-sm gap-2',
    lg: 'h-14 px-6 text-base gap-2.5',
};

const iconSizeStyles: Record<ButtonSize, string> = {
    sm: '[&_svg]:w-4 [&_svg]:h-4',
    md: '[&_svg]:w-5 [&_svg]:h-5',
    lg: '[&_svg]:w-5 [&_svg]:h-5',
};

/**
 * Button - базовый компонент кнопки
 * 
 * @example
 * // Primary кнопка
 * <Button>Нажать</Button>
 * 
 * // С иконкой
 * <Button leftIcon={<PlusIcon />} variant="secondary">
 *   Добавить
 * </Button>
 * 
 * // Состояние загрузки
 * <Button isLoading>Загрузка...</Button>
 * 
 * // Emergency для опасных действий
 * <Button variant="emergency" onClick={handleDelete}>
 *   Удалить
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            fullWidth = false,
            haptic = 'light',
            disabled,
            className,
            onClick,
            ...props
        },
        ref
    ) => {
        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            // Haptic feedback для мобильных устройств
            if (haptic && typeof window !== 'undefined' && 'Telegram' in window) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred(haptic);
                }
            }
            onClick?.(e);
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                onClick={handleClick}
                className={cn(
                    // Базовые стили
                    'inline-flex items-center justify-center',
                    'font-medium rounded-xl',
                    'transition-all duration-200 ease-out',
                    'active:scale-95',
                    'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
                    'focus:outline-none',
                    'touch-manipulation',

                    // Варианты и размеры
                    variantStyles[variant],
                    sizeStyles[size],
                    iconSizeStyles[size],

                    // Полная ширина
                    fullWidth && 'w-full',

                    className
                )}
                aria-busy={isLoading}
                aria-disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>{children}</span>
                    </>
                ) : (
                    <>
                        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                        <span className="truncate">{children}</span>
                        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                    </>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
