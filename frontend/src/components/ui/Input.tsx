import React, { forwardRef, InputHTMLAttributes, ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';

export type InputType = 'text' | 'number' | 'password' | 'search';
export type InputValidationState = 'default' | 'error' | 'success';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    /** Тип инпута */
    type?: InputType;
    /** Лейбл */
    label?: string;
    /** Текст ошибки */
    error?: string;
    /** Текст подсказки */
    helperText?: string;
    /** Иконка слева */
    leftIcon?: ReactNode;
    /** Иконка справа */
    rightIcon?: ReactNode;
    /** Состояние валидации */
    validationState?: InputValidationState;
    /** Полная ширина */
    fullWidth?: boolean;
    /** Haptic feedback при фокусе */
    haptic?: boolean;
}

const typeStyles: Record<InputType, string> = {
    text: '',
    number: 'text-center font-mono text-lg',
    password: '',
    search: 'pl-10 pr-4',
};

const validationStyles: Record<InputValidationState, string> = {
    default: cn(
        'border-transparent',
        'focus:border-primary focus:ring-2 focus:ring-primary/20'
    ),
    error: cn(
        'border-danger',
        'focus:border-danger focus:ring-2 focus:ring-danger/20'
    ),
    success: cn(
        'border-success',
        'focus:border-success focus:ring-2 focus:ring-success/20'
    ),
};

/**
 * Input - компонент текстового поля ввода
 * 
 * @example
 * // Базовый инпут с лейблом
 * <Input
 *   label="Email"
 *   placeholder="Введите email"
 *   type="text"
 * />
 * 
 * // С иконкой поиска
 * <Input
 *   type="search"
 *   leftIcon={<SearchIcon />}
 *   placeholder="Поиск упражнений..."
 * />
 * 
 * // С ошибкой
 * <Input
 *   label="Пароль"
 *   type="password"
 *   error="Пароль слишком короткий"
 *   validationState="error"
 * />
 * 
 * // С подтверждением
 * <Input
 *   label="Имя"
 *   validationState="success"
 *   helperText="Имя доступно"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            type = 'text',
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            validationState = 'default',
            fullWidth = true,
            haptic = true,
            disabled,
            className,
            id,
            onFocus,
            onBlur,
            ...props
        },
        ref
    ) => {
        const [showPassword, setShowPassword] = useState(false);

        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
        const hasError = validationState === 'error' || !!error;
        const hasSuccess = validationState === 'success';

        // Определяем реальный тип для password
        const actualType = type === 'password'
            ? (showPassword ? 'text' : 'password')
            : type;

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            // Haptic feedback при фокусе
            if (haptic && typeof window !== 'undefined' && 'Telegram' in window) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.selectionChanged();
                }
            }
            onFocus?.(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            onBlur?.(e);
        };

        const togglePassword = () => {
            setShowPassword(!showPassword);
        };

        return (
            <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
                {/* Лейбл */}
                {label && (
                    <label
                        htmlFor={inputId}
                        className={cn(
                            'text-sm font-medium',
                            disabled ? 'text-telegram-hint' : 'text-telegram-text'
                        )}
                    >
                        {label}
                    </label>
                )}

                {/* Контейнер инпута */}
                <div className="relative">
                    {/* Левая иконка */}
                    {leftIcon && (
                        <div
                            className={cn(
                                'absolute left-3 top-1/2 -translate-y-1/2',
                                'text-telegram-hint',
                                'pointer-events-none',
                                type === 'number' && 'hidden' // Скрываем для number типа
                            )}
                        >
                            {leftIcon}
                        </div>
                    )}

                    {/* Поле ввода */}
                    <input
                        ref={ref}
                        id={inputId}
                        type={actualType}
                        disabled={disabled}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className={cn(
                            // Базовые стили
                            'w-full bg-telegram-secondary-bg',
                            'rounded-xl px-4 py-3',
                            'text-telegram-text placeholder:text-telegram-hint',
                            'transition-all duration-200',
                            'focus:outline-none',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'touch-manipulation',

                            // Тип специфичные стили
                            typeStyles[type],

                            // Валидация
                            validationStyles[validationState],

                            // Отступы для иконок
                            leftIcon && type !== 'number' && !typeStyles[type].includes('pl-') && 'pl-10',
                            (rightIcon || type === 'password') && 'pr-10',

                            className
                        )}
                        aria-invalid={hasError}
                        aria-describedby={
                            error
                                ? `${inputId}-error`
                                : helperText
                                    ? `${inputId}-helper`
                                    : undefined
                        }
                        {...props}
                    />

                    {/* Правая иконка или кнопка показа пароля */}
                    {(rightIcon || type === 'password') && (
                        <div
                            className={cn(
                                'absolute right-3 top-1/2 -translate-y-1/2',
                                type === 'password' ? 'cursor-pointer' : 'pointer-events-none',
                                'text-telegram-hint',
                                'transition-colors duration-200',
                                type === 'password' && 'hover:text-telegram-text'
                            )}
                            onClick={type === 'password' ? togglePassword : undefined}
                            role={type === 'password' ? 'button' : undefined}
                            tabIndex={type === 'password' ? 0 : undefined}
                            onKeyDown={
                                type === 'password'
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            togglePassword();
                                        }
                                    }
                                    : undefined
                            }
                        >
                            {type === 'password' ? (
                                showPassword ? (
                                    // Eye Off Icon
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                        <line x1="2" x2="22" y1="2" y2="22" />
                                    </svg>
                                ) : (
                                    // Eye Icon
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )
                            ) : (
                                rightIcon
                            )}
                        </div>
                    )}
                </div>

                {/* Текст ошибки или подсказки */}
                {(error || helperText) && (
                    <p
                        id={error ? `${inputId}-error` : `${inputId}-helper`}
                        className={cn(
                            'text-sm',
                            hasError && 'text-danger',
                            hasSuccess && 'text-success',
                            !hasError && !hasSuccess && 'text-telegram-hint'
                        )}
                        role={hasError ? 'alert' : undefined}
                    >
                        {error || helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
