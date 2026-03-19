import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type ChipSize = 'sm' | 'md';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
    /** Текст чипа */
    label: string;
    /** Активное состояние */
    active?: boolean;
    /** Обработчик клика */
    onClick?: (active: boolean) => void;
    /** Иконка */
    icon?: ReactNode;
    /** Размер */
    size?: ChipSize;
    /** Отключен */
    disabled?: boolean;
    /** Haptic feedback */
    haptic?: boolean;
    /** Вариант чипа */
    variant?: 'default' | 'outlined' | 'filled';
}

const sizeStyles: Record<ChipSize, string> = {
    sm: 'h-7 px-2.5 text-xs gap-1',
    md: 'h-9 px-3.5 text-sm gap-1.5',
};

const iconSizeStyles: Record<ChipSize, string> = {
    sm: '[&_svg]:w-3.5 [&_svg]:h-3.5',
    md: '[&_svg]:w-4 [&_svg]:h-4',
};

/**
 * Chip - компонент тега/чипа
 * 
 * @example
 * // Базовый чип
 * <Chip label="Силовая" />
 * 
 * // Активный чип
 * <Chip label="Кардио" active onClick={toggle} />
 * 
 * // С иконкой
 * <Chip 
 *   label="Бег" 
 *   icon={<RunIcon />} 
 *   active={isSelected}
 *   onClick={handleSelect}
 * />
 * 
 * // Multiselect группа
 * <div className="flex flex-wrap gap-2">
 *   {tags.map(tag => (
 *     <Chip
 *       key={tag.id}
 *       label={tag.name}
 *       active={selected.has(tag.id)}
 *       onClick={() => toggleTag(tag.id)}
 *     />
 *   ))}
 * </div>
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
    (
        {
            label,
            active = false,
            onClick,
            icon,
            size = 'md',
            disabled = false,
            haptic = true,
            variant = 'default',
            className,
            ...props
        },
        ref
    ) => {
        const handleClick = () => {
            // Haptic feedback
            if (haptic && typeof window !== 'undefined' && 'Telegram' in window) {
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.selectionChanged();
                }
            }
            onClick?.(!active);
        };

        const getVariantStyles = () => {
            if (variant === 'outlined') {
                return active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-telegram-text border-border hover:border-primary-300';
            }

            if (variant === 'filled') {
                return active
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'bg-telegram-secondary-bg text-telegram-text border-transparent hover:bg-neutral-200';
            }

            // default variant
            return active
                ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800'
                : 'bg-telegram-secondary-bg text-telegram-text border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700';
        };

        return (
            <button
                ref={ref}
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={cn(
                    // Базовые стили
                    'inline-flex items-center justify-center',
                    'font-medium rounded-full',
                    'border transition-all duration-200',
                    'active:scale-95',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30',
                    'touch-manipulation',

                    // Размеры
                    sizeStyles[size],
                    iconSizeStyles[size],

                    // Варианты
                    getVariantStyles(),

                    className
                )}
                aria-pressed={active}
                {...props}
            >
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className="truncate">{label}</span>

                {/* Индикатор активности (checkmark) */}
                {active && (
                    <svg
                        className="flex-shrink-0 ml-0.5"
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>
        );
    }
);

Chip.displayName = 'Chip';

export default Chip;

// ============================================
// ChipGroup - группа чипов для multiselect
// ============================================

export interface ChipGroupProps {
    /** Чипы */
    children: ReactNode;
    /** Ориентация */
    direction?: 'horizontal' | 'vertical';
    /** Перенос на новую строку */
    wrap?: boolean;
    /** Расстояние между чипами */
    gap?: 'sm' | 'md' | 'lg';
    /** CSS класс */
    className?: string;
}

const gapStyles = {
    sm: 'gap-1.5',
    md: 'gap-2',
    lg: 'gap-3',
};

/**
 * ChipGroup - группировка чипов
 * 
 * @example
 * <ChipGroup wrap>
 *   <Chip label="Силовая" active />
 *   <Chip label="Кардио" />
 *   <Chip label="Растяжка" />
 * </ChipGroup>
 */
export const ChipGroup: React.FC<ChipGroupProps> = ({
    children,
    direction = 'horizontal',
    wrap = true,
    gap = 'md',
    className,
}) => {
    return (
        <div
            className={cn(
                'flex',
                direction === 'horizontal' ? 'flex-row' : 'flex-col',
                wrap && 'flex-wrap',
                gapStyles[gap],
                className
            )}
            role="group"
            aria-label="Chip group"
        >
            {children}
        </div>
    );
};

ChipGroup.displayName = 'ChipGroup';
