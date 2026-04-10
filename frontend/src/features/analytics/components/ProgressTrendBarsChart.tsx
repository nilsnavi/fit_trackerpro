import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface TrendItem {
    label: string
    value: number
}

interface ProgressTrendBarsChartProps {
    items: TrendItem[]
    valueFormatter?: (value: number) => string
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
            <p className="mt-1 text-xs text-telegram-hint">{valueFormatter ? valueFormatter(value) : value}</p>
        </div>
    )
}

export function ProgressTrendBarsChart({ items, valueFormatter }: ProgressTrendBarsChartProps) {
    return (
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
    )
}

