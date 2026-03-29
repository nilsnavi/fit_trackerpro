import type { LucideIcon } from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { Button } from './Button';

export type EmptyStateTone = 'default' | 'telegram';

export interface EmptyStateAction {
    label: string;
    onClick: () => void;
}

export interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    primaryAction?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
    tone?: EmptyStateTone;
    className?: string;
    compact?: boolean;
}

const toneClasses: Record<
    EmptyStateTone,
    { iconBg: string; icon: string; title: string; desc: string }
> = {
    default: {
        iconBg: 'bg-gray-100 dark:bg-neutral-800',
        icon: 'text-gray-400 dark:text-gray-500',
        title: 'text-gray-900 dark:text-white',
        desc: 'text-gray-500 dark:text-gray-400',
    },
    telegram: {
        iconBg: 'bg-telegram-secondary-bg',
        icon: 'text-telegram-hint',
        title: 'text-telegram-text',
        desc: 'text-telegram-hint',
    },
};

/**
 * EmptyState — пустое состояние экрана или секции (иконка, текст, действия).
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    primaryAction,
    secondaryAction,
    tone = 'default',
    className,
    compact = false,
}: EmptyStateProps) {
    const t = toneClasses[tone];
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-6 px-2' : 'py-10 px-4',
                className
            )}
            role="status"
            aria-live="polite"
        >
            <div
                className={cn(
                    'mb-4 flex items-center justify-center rounded-2xl',
                    compact ? 'h-14 w-14' : 'h-20 w-20',
                    t.iconBg
                )}
            >
                <Icon className={cn(compact ? 'h-7 w-7' : 'h-10 w-10', t.icon)} strokeWidth={1.75} />
            </div>
            <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base', t.title)}>{title}</p>
            {description ? (
                <p className={cn('mt-1 max-w-sm', compact ? 'text-xs' : 'text-sm', t.desc)}>{description}</p>
            ) : null}
            {(primaryAction || secondaryAction) && (
                <div className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
                    {primaryAction && (
                        <Button
                            type="button"
                            variant="primary"
                            fullWidth
                            className="sm:flex-1"
                            onClick={primaryAction.onClick}
                        >
                            {primaryAction.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            type="button"
                            variant="ghost"
                            fullWidth
                            className="sm:flex-1"
                            onClick={secondaryAction.onClick}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

EmptyState.displayName = 'EmptyState';

export default EmptyState;
