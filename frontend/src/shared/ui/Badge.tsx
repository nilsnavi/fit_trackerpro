import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@shared/lib/cn';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    /** Компактный размер */
    size?: 'sm' | 'md';
    /** Цветная точка слева от текста */
    dot?: boolean;
    children: ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
};

const dotClass: Record<BadgeVariant, string> = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
    neutral: 'bg-neutral-500',
};

const sizeClass = {
    sm: 'text-[10px] px-2 py-0',
    md: 'text-xs px-2.5 py-0.5',
} as const;

/**
 * Badge — статус или метка (inline).
 */
export function Badge({
    variant = 'neutral',
    size = 'md',
    dot = false,
    className,
    children,
    ...props
}: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center gap-1 rounded-full font-medium',
                variantClass[variant],
                size !== 'md' && sizeClass[size],
                className
            )}
            {...props}
        >
            {dot && (
                <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass[variant])}
                    aria-hidden
                />
            )}
            {children}
        </span>
    );
}

Badge.displayName = 'Badge';

export default Badge;
