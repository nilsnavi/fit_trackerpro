import { cn } from '@shared/lib/cn'

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

export function ProgressTrendBars({
    title,
    subtitle,
    items,
    valueFormatter,
    emptyMessage,
}: ProgressTrendBarsProps) {
    const maxValue = items.reduce((acc, item) => Math.max(acc, item.value), 0)

    return (
        <section className="rounded-2xl bg-telegram-secondary-bg p-4">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-telegram-text">{title}</h2>
                {subtitle ? <p className="mt-0.5 text-xs text-telegram-hint">{subtitle}</p> : null}
            </div>

            {items.length === 0 ? (
                <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">{emptyMessage}</p>
            ) : (
                <div className="space-y-2.5">
                    {items.map((item) => {
                        const widthPercent = maxValue > 0 ? Math.max(6, Math.round((item.value / maxValue) * 100)) : 6
                        return (
                            <div key={item.label}>
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs text-telegram-text">{item.label}</p>
                                    <p className="shrink-0 text-xs font-medium text-telegram-hint">
                                        {valueFormatter ? valueFormatter(item.value) : item.value}
                                    </p>
                                </div>
                                <div className="h-2 rounded-full bg-telegram-bg">
                                    <div
                                        className={cn('h-2 rounded-full bg-primary transition-all duration-300')}
                                        style={{ width: `${widthPercent}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
