interface WorkoutHistoryCardSkeletonProps {
    count?: number
}

export function WorkoutHistoryCardSkeleton({ count = 3 }: WorkoutHistoryCardSkeletonProps) {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Загрузка истории тренировок">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="rounded-2xl bg-telegram-secondary-bg p-4">
                    <div className="flex items-start gap-3">
                        {/* Skeleton иконки */}
                        <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-telegram-bg" />

                        <div className="min-w-0 flex-1 space-y-3">
                            {/* Skeleton заголовка */}
                            <div className="h-5 w-3/4 animate-pulse rounded bg-telegram-bg" />

                            {/* Skeleton даты */}
                            <div className="h-3 w-1/3 animate-pulse rounded bg-telegram-bg" />

                            {/* Skeleton метрик */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="mb-1 h-3 w-12 animate-pulse rounded bg-telegram-bg" />
                                    <div className="h-4 w-16 animate-pulse rounded bg-telegram-bg" />
                                </div>
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="mb-1 h-3 w-12 animate-pulse rounded bg-telegram-bg" />
                                    <div className="h-4 w-8 animate-pulse rounded bg-telegram-bg" />
                                </div>
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="mb-1 h-3 w-12 animate-pulse rounded bg-telegram-bg" />
                                    <div className="h-4 w-14 animate-pulse rounded bg-telegram-bg" />
                                </div>
                            </div>
                        </div>

                        {/* Skeleton стрелки */}
                        <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-telegram-bg" />
                    </div>

                    {/* Skeleton кнопки "Повторить" */}
                    <div className="mt-3 border-t border-border/50 pt-2">
                        <div className="h-10 w-full animate-pulse rounded-xl bg-telegram-bg" />
                    </div>
                </div>
            ))}
        </div>
    )
}
