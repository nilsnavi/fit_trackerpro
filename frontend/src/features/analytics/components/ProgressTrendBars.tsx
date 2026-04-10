import { lazy, Suspense } from 'react'

interface TrendItem {
    label: string
    value: number
}

interface ProgressTrendBarsProps {
    title: string
    subtitle?: string
    items: TrendItem[]
    valueFormatter?: (value: number) => string
    emptyMessage: string
}

const ProgressTrendBarsChart = lazy(() =>
    import('./ProgressTrendBarsChart').then((m) => ({ default: m.ProgressTrendBarsChart })),
)

export function ProgressTrendBars({
    title,
    subtitle,
    items,
    valueFormatter,
    emptyMessage,
}: ProgressTrendBarsProps) {
    return (
        <section className="rounded-2xl bg-telegram-secondary-bg p-4">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-telegram-text">{title}</h2>
                {subtitle ? <p className="mt-0.5 text-xs text-telegram-hint">{subtitle}</p> : null}
            </div>

            {items.length === 0 ? (
                <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">{emptyMessage}</p>
            ) : (
                <>
                    <Suspense
                        fallback={<div className="h-56 -mx-2 rounded-2xl bg-telegram-bg/60 animate-pulse" />}
                    >
                        <ProgressTrendBarsChart items={items} valueFormatter={valueFormatter} />
                    </Suspense>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {items.slice(-2).map((item) => (
                            <div key={item.label} className="rounded-lg bg-telegram-bg px-3 py-2">
                                <p className="text-[11px] text-telegram-hint">{item.label}</p>
                                <p className="mt-1 text-sm font-semibold text-telegram-text">
                                    {valueFormatter ? valueFormatter(item.value) : item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    )
}
