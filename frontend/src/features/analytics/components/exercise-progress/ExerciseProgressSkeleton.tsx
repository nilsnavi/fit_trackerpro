import { cn } from '@shared/lib/cn'

interface ExerciseProgressSkeletonProps {
    className?: string
}

export function ExerciseProgressSkeleton({ className }: ExerciseProgressSkeletonProps) {
    return (
        <div className={cn('space-y-4 p-4', className)}>
            {/* Selector skeleton */}
            <div className="h-12 animate-pulse rounded-xl bg-telegram-secondary-bg" />

            {/* Metrics skeleton */}
            <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-telegram-secondary-bg" />
                ))}
            </div>

            {/* Charts skeleton */}
            <div className="h-64 animate-pulse rounded-xl bg-telegram-secondary-bg" />
            <div className="h-64 animate-pulse rounded-xl bg-telegram-secondary-bg" />

            {/* History skeleton */}
            <div className="rounded-xl bg-telegram-secondary-bg">
                <div className="h-12 animate-pulse border-b border-border" />
                <div className="divide-y divide-border">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 animate-pulse px-4 py-3" />
                    ))}
                </div>
            </div>
        </div>
    )
}
