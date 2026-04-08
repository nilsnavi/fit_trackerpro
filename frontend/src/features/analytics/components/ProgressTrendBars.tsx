import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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

function TrendTooltip({
    active,
    payload,
    label,
    valueFormatter,
}: {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
    valueFormatter?: (value: number) => string
}) {
    if (!active || !payload || payload.length === 0) return null
    const value = Number(payload[0]?.value ?? 0)
    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">
                {valueFormatter ? valueFormatter(value) : value}
            </p>
        </div>
    )
}

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
                    <div className="h-56 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={items} margin={{ top: 8, right: 10, left: 6, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} minTickGap={12} />
                                <YAxis tick={{ fontSize: 11 }} width={38} />
                                <Tooltip content={<TrendTooltip valueFormatter={valueFormatter} />} />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
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
