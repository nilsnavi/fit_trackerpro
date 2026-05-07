import { SimpleBarChart } from './SimpleCharts'

interface TrendItem {
    label: string
    value: number
}

interface ProgressTrendBarsChartProps {
    items: TrendItem[]
    valueFormatter?: (value: number) => string
}

export function ProgressTrendBarsChart({ items, valueFormatter }: ProgressTrendBarsChartProps) {
    return (
        <SimpleBarChart
            data={items}
            labelKey="label"
            valueKey="value"
            formatter={valueFormatter}
        />
    )
}

