/**
 * Skeleton placeholders for main app screens (lazy route fallback + in-page loading).
 * Uses `.skeleton` from globals.css (animate-pulse, theme-aware).
 */

export function ProfilePageSkeleton() {
    return (
        <div
            className="p-4 space-y-6 pb-24"
            aria-busy="true"
            aria-label="Загрузка профиля"
        >
            <div className="flex items-center gap-4">
                <div className="skeleton h-20 w-20 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-6 w-40 rounded" />
                    <div className="skeleton h-4 w-28 rounded" />
                    <div className="flex gap-2">
                        <div className="skeleton h-6 w-20 rounded-full" />
                        <div className="skeleton h-6 w-16 rounded-full" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-2xl bg-telegram-secondary-bg/80 p-4">
                        <div className="skeleton mx-auto mb-2 h-10 w-10 rounded-xl" />
                        <div className="skeleton mx-auto mb-1 h-7 w-12 rounded" />
                        <div className="skeleton mx-auto h-3 w-16 rounded" />
                    </div>
                ))}
            </div>

            <div className="space-y-4 rounded-2xl bg-telegram-secondary-bg/80 p-4">
                <div className="skeleton h-5 w-36 rounded" />
                <div className="flex justify-between gap-4">
                    <div className="space-y-2">
                        <div className="skeleton h-3 w-24 rounded" />
                        <div className="skeleton h-8 w-20 rounded" />
                    </div>
                    <div className="space-y-2 text-right">
                        <div className="skeleton ml-auto h-3 w-24 rounded" />
                        <div className="skeleton ml-auto h-8 w-20 rounded" />
                    </div>
                </div>
                <div className="skeleton h-3 w-full rounded-full" />
                <div className="flex justify-between">
                    <div className="skeleton h-4 w-28 rounded" />
                    <div className="skeleton h-4 w-32 rounded" />
                </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-telegram-secondary-bg/80 p-4">
                <div className="skeleton h-5 w-44 rounded" />
                <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton h-8 w-24 rounded-full" />
                    ))}
                </div>
                <div className="skeleton h-3 w-full rounded" />
                <div className="flex flex-wrap gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="skeleton h-8 w-20 rounded-full" />
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <div className="skeleton h-12 w-full rounded-xl" />
                <div className="skeleton h-12 w-full rounded-xl" />
            </div>
        </div>
    )
}

export function CatalogExerciseListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Загрузка списка упражнений">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-telegram-bg p-4"
                >
                    <div className="skeleton h-16 w-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="skeleton h-5 w-[75%] max-w-[200px] rounded" />
                        <div className="flex gap-2">
                            <div className="skeleton h-5 w-16 rounded-full" />
                            <div className="skeleton h-5 w-20 rounded-full" />
                        </div>
                        <div className="flex gap-2">
                            <div className="skeleton h-4 w-14 rounded" />
                            <div className="skeleton h-4 w-14 rounded" />
                        </div>
                    </div>
                    <div className="skeleton h-5 w-5 shrink-0 rounded" />
                </div>
            ))}
        </div>
    )
}

/** Full catalog shell for lazy route (header + list). */
export function CatalogPageSkeleton() {
    return (
        <div className="min-h-screen bg-telegram-bg pb-24" aria-busy="true" aria-label="Загрузка каталога">
            <div className="sticky top-0 z-20 border-b border-border bg-telegram-bg/95 backdrop-blur-sm">
                <div className="px-4 py-3">
                    <div className="skeleton mb-2 h-7 w-56 rounded" />
                    <div className="skeleton h-4 w-32 rounded" />
                </div>
                <div className="px-4 pb-3">
                    <div className="skeleton h-11 w-full rounded-xl" />
                </div>
                <div className="px-4 pb-3">
                    <div className="flex gap-2 overflow-hidden">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-8 w-24 shrink-0 rounded-full" />
                        ))}
                    </div>
                </div>
                <div className="px-4 pb-3">
                    <div className="skeleton h-10 w-28 rounded-xl" />
                </div>
            </div>
            <div className="px-4 py-4">
                <CatalogExerciseListSkeleton rows={8} />
            </div>
        </div>
    )
}

/** Weekly summary + recent workouts (in-page loading). */
export function WorkoutsHistoryBlockSkeleton() {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Загрузка истории тренировок">
            <div className="rounded-xl bg-gray-50 p-4 transition-colors dark:bg-neutral-800">
                <div className="skeleton mb-3 h-4 w-28 rounded" />
                <div className="grid grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="text-center space-y-2">
                            <div className="skeleton mx-auto h-8 w-12 rounded" />
                            <div className="skeleton mx-auto h-3 w-16 rounded" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="skeleton h-6 w-32 rounded" />
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-neutral-800"
                >
                    <div className="skeleton h-12 w-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="skeleton h-5 w-[75%] max-w-[220px] rounded" />
                        <div className="flex gap-3">
                            <div className="skeleton h-4 w-20 rounded" />
                            <div className="skeleton h-4 w-24 rounded" />
                        </div>
                    </div>
                    <div className="skeleton h-5 w-5 shrink-0 rounded" />
                </div>
            ))}
        </div>
    )
}

export function WorkoutsPageSkeleton() {
    return (
        <div className="space-y-6 p-4" aria-busy="true" aria-label="Загрузка тренировок">
            <div className="flex items-center justify-between gap-3">
                <div className="skeleton h-9 w-40 rounded" />
                <div className="flex gap-2">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="skeleton h-10 w-10 rounded-full" />
                </div>
            </div>
            <div className="flex gap-2 overflow-hidden pb-2">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton h-9 w-16 shrink-0 rounded-full" />
                ))}
            </div>
            <div className="space-y-3">
                <div className="skeleton h-7 w-48 rounded" />
                <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-24 rounded-xl" />
                    ))}
                </div>
            </div>
            <WorkoutsHistoryBlockSkeleton />
        </div>
    )
}

export function AnalyticsPageSkeleton() {
    return (
        <div className="min-h-screen bg-telegram-bg pb-20" aria-busy="true" aria-label="Загрузка аналитики">
            <div className="sticky top-0 z-10 border-b border-border bg-telegram-bg/95 backdrop-blur-sm">
                <div className="px-4 py-3">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="skeleton h-7 w-36 rounded" />
                        <div className="skeleton h-9 w-24 rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                        <div className="skeleton h-9 flex-1 rounded-full" />
                        <div className="skeleton h-9 flex-1 rounded-full" />
                    </div>
                </div>
            </div>
            <div className="space-y-6 p-4">
                <section>
                    <div className="skeleton mb-3 h-4 w-16 rounded" />
                    <div className="flex flex-wrap gap-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-8 w-20 rounded-full" />
                        ))}
                    </div>
                </section>
                <section>
                    <div className="skeleton mb-3 h-4 w-64 rounded" />
                    <div className="skeleton h-12 w-full rounded-xl" />
                </section>
                <section>
                    <div className="skeleton mb-3 h-4 w-36 rounded" />
                    <div className="grid grid-cols-2 gap-3">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="rounded-2xl border border-border bg-telegram-secondary-bg/50 p-3">
                                <div className="skeleton mb-2 h-4 w-24 rounded" />
                                <div className="skeleton h-7 w-16 rounded" />
                            </div>
                        ))}
                    </div>
                </section>
                <section>
                    <div className="skeleton mb-3 h-4 w-28 rounded" />
                    <div className="rounded-2xl border border-border bg-telegram-secondary-bg/30 p-4">
                        <div className="skeleton h-80 w-full rounded-xl" />
                    </div>
                </section>
            </div>
        </div>
    )
}

export function RouteFallbackSpinner() {
    return (
        <div
            className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 p-6"
            aria-busy="true"
            aria-live="polite"
        >
            <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                role="status"
                aria-label="Загрузка страницы"
            />
        </div>
    )
}
