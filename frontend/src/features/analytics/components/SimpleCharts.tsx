import type { ReactNode } from 'react'

type ChartValue = number | null | undefined

interface ChartSeries<T> {
    key: keyof T
    label: string
    color: string
    area?: boolean
    formatter?: (value: number) => string
}

interface SimpleLineChartProps<T extends object> {
    data: T[]
    labelKey: keyof T
    series: Array<ChartSeries<T>>
    heightClassName?: string
}

interface SimpleBarChartProps<T extends object> {
    data: T[]
    labelKey: keyof T
    valueKey: keyof T
    color?: string
    formatter?: (value: number) => string
    heightClassName?: string
}

const VIEWBOX_WIDTH = 360
const VIEWBOX_HEIGHT = 220
const PADDING = {
    top: 16,
    right: 18,
    bottom: 34,
    left: 34,
}

function toNumber(value: ChartValue): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return value
}

function formatTick(value: number) {
    if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`
    if (Math.abs(value) < 10 && value % 1 !== 0) return value.toFixed(1)
    return String(Math.round(value))
}

function getRange(values: number[]) {
    if (values.length === 0) return { min: 0, max: 1 }

    let min = Math.min(...values)
    let max = Math.max(...values)

    if (min === max) {
        min -= 1
        max += 1
    }

    const padding = (max - min) * 0.12
    return { min: min - padding, max: max + padding }
}

function useChartGeometry(values: number[]) {
    const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
    const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
    const range = getRange(values)

    const yFor = (value: number) =>
        PADDING.top + ((range.max - value) / (range.max - range.min)) * plotHeight

    return {
        plotWidth,
        plotHeight,
        range,
        x0: PADDING.left,
        y0: PADDING.top,
        yBottom: PADDING.top + plotHeight,
        xFor: (index: number, count: number) =>
            PADDING.left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth),
        yFor,
    }
}

function ChartFrame({
    children,
    labels,
    values,
    heightClassName = 'h-56',
}: {
    children: ReactNode
    labels: string[]
    values: number[]
    heightClassName?: string
}) {
    const geometry = useChartGeometry(values)
    const gridValues = [
        geometry.range.min,
        geometry.range.min + (geometry.range.max - geometry.range.min) / 2,
        geometry.range.max,
    ]
    const visibleLabels = labels.filter((_, index) => index === 0 || index === labels.length - 1)

    return (
        <div className={`${heightClassName} -mx-2`}>
            <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
                {gridValues.map((value) => {
                    const y = geometry.yFor(value)
                    return (
                        <g key={value}>
                            <line
                                x1={geometry.x0}
                                x2={VIEWBOX_WIDTH - PADDING.right}
                                y1={y}
                                y2={y}
                                stroke="rgba(148, 163, 184, 0.3)"
                                strokeDasharray="4 4"
                            />
                            <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="fill-telegram-hint text-[10px]">
                                {formatTick(value)}
                            </text>
                        </g>
                    )
                })}
                {children}
                {visibleLabels.map((label, index) => (
                    <text
                        key={`${label}-${index}`}
                        x={index === 0 ? PADDING.left : VIEWBOX_WIDTH - PADDING.right}
                        y={VIEWBOX_HEIGHT - 10}
                        textAnchor={index === 0 ? 'start' : 'end'}
                        className="fill-telegram-hint text-[10px]"
                    >
                        {label}
                    </text>
                ))}
            </svg>
        </div>
    )
}

function linePath(points: Array<{ x: number; y: number }>) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

export function SimpleLineChart<T extends object>({
    data,
    labelKey,
    series,
    heightClassName,
}: SimpleLineChartProps<T>) {
    const labels = data.map((item) => String(item[labelKey] ?? ''))
    const values = data.flatMap((item) =>
        series.map((line) => toNumber(item[line.key] as ChartValue)).filter((value): value is number => value != null),
    )
    const geometry = useChartGeometry(values)

    return (
        <ChartFrame labels={labels} values={values} heightClassName={heightClassName}>
            {series.map((line) => {
                const points = data
                    .map((item, index) => {
                        const value = toNumber(item[line.key] as ChartValue)
                        if (value == null) return null
                        return {
                            x: geometry.xFor(index, data.length),
                            y: geometry.yFor(value),
                            value,
                            label: String(item[labelKey] ?? ''),
                        }
                    })
                    .filter((point): point is { x: number; y: number; value: number; label: string } => point != null)

                if (points.length === 0) return null

                const path = linePath(points)
                const areaPath = `${path} L ${points[points.length - 1].x} ${geometry.yBottom} L ${points[0].x} ${geometry.yBottom} Z`

                return (
                    <g key={String(line.key)}>
                        {line.area ? <path d={areaPath} fill={line.color} opacity="0.14" /> : null}
                        <path d={path} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((point) => (
                            <circle key={`${line.label}-${point.label}-${point.x}`} cx={point.x} cy={point.y} r="3" fill={line.color}>
                                <title>
                                    {point.label}: {line.formatter ? line.formatter(point.value) : point.value}
                                </title>
                            </circle>
                        ))}
                    </g>
                )
            })}
        </ChartFrame>
    )
}

export function SimpleBarChart<T extends object>({
    data,
    labelKey,
    valueKey,
    color = 'hsl(var(--primary))',
    formatter,
    heightClassName,
}: SimpleBarChartProps<T>) {
    const labels = data.map((item) => String(item[labelKey] ?? ''))
    const values = data.map((item) => toNumber(item[valueKey] as ChartValue) ?? 0)
    const geometry = useChartGeometry([0, ...values])
    const gap = 8
    const barWidth = Math.max(8, (geometry.plotWidth - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length))

    return (
        <ChartFrame labels={labels} values={[0, ...values]} heightClassName={heightClassName}>
            {values.map((value, index) => {
                const x = PADDING.left + index * (barWidth + gap)
                const y = geometry.yFor(value)
                const height = Math.max(2, geometry.yBottom - y)
                const label = labels[index]

                return (
                    <rect key={`${label}-${index}`} x={x} y={y} width={barWidth} height={height} rx="6" fill={color}>
                        <title>
                            {label}: {formatter ? formatter(value) : value}
                        </title>
                    </rect>
                )
            })}
        </ChartFrame>
    )
}
