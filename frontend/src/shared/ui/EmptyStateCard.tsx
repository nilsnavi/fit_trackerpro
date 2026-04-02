import { cn } from '@shared/lib/cn'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import type { EmptyStateProps } from './EmptyState'

export interface EmptyStateCardProps extends EmptyStateProps {
    /** Extra class name applied to the wrapping Card element */
    cardClassName?: string
}

/**
 * EmptyStateCard — EmptyState wrapped in a Card.
 * Use it when you want the empty state to sit inside a visual container
 * (bordered card) rather than filling the full viewport.
 *
 * @example
 * <EmptyStateCard
 *   icon={Dumbbell}
 *   title="Нет шаблонов"
 *   description="Создайте первый шаблон тренировки"
 *   primaryAction={{ label: 'Создать', onClick: handleCreate }}
 *   tone="telegram"
 * />
 */
export function EmptyStateCard({ cardClassName, ...emptyStateProps }: EmptyStateCardProps) {
    return (
        <Card
            variant="info"
            className={cn('overflow-hidden', cardClassName)}
        >
            <EmptyState {...emptyStateProps} />
        </Card>
    )
}
