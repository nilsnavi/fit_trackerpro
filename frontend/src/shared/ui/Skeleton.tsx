import type { HTMLAttributes } from 'react';
import { cn } from '@shared/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    /** Скругление блока */
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const roundedMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
} as const;

/**
 * Skeleton — плейсхолдер загрузки (использует `.skeleton` из globals.css).
 */
export function Skeleton({ className, rounded = 'md', ...props }: SkeletonProps) {
    return (
        <div
            className={cn('skeleton', roundedMap[rounded], className)}
            aria-hidden
            {...props}
        />
    );
}

Skeleton.displayName = 'Skeleton';

export default Skeleton;
