import { useMemo } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@shared/lib/cn'

interface ChartDataPoint {
    date: string
    formattedDate: string
    weight: number | null
    volume: number | null
}

interface ExerciseChartsProps {
    dates: string[]
    weights: (number | null)[]
    volumes: (number | null)[]
    className?: string
}

function WeightTooltip({ active, payload, label }: { 
    active?: boolean
    payload?: Array<{ value: number | null; name?: string }>
    label?: string 
}) {
    if (!active || !payload || payload.length === 0 || payload[0].value === null) {
        return null
    }

    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">
                Вес:{' '}
                <span className="font-medium text-primary">{payload[0].value} кг</span>
            </p>
        </div>
    )
}

function VolumeTooltip({ active, payload, label }: { 
    active?: boolean
    payload?: Array<{ value: number | null }>
    label?: string 
}) {
    if (!active || !payload || payload.length === 0 || payload[0].value === null) {
        return null
    }

    const volume = payload[0].value
    const formattedVolume = volume >= 1000 
        ? `${(volume / 1000).toFixed(1)} т` 
        : `${Math.round(volume)} кг`

    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">
                Объём:{' '}
                <span className="font-medium text-primary">{formattedVolume}</span>
            </p>
        </div>
    )
}

export function ExerciseWeightChart({ dates, weights, className }: {
    dates: string[]
    weights: (number | null)[]
    className?: string
}) {
    const chartData = useMemo(() => {
        return dates.map((date, index) => ({
            date,
            formattedDate: format(parseISO(date), 'dd MMM', { locale: ru }),
            weight: weights[index],
        }))
    }, [dates, weights])

    if (chartData.length === 0) {
        return (
            <div className={cn('h-64 rounded-xl bg-telegram-secondary-bg p-4', className)}>
                <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-telegram-hint">Нет данных для отображения</p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('h-64 rounded-xl bg-telegram-secondary-bg p-4', className)}>
            <h3 className="mb-3 text-sm font-semibold text-telegram-text">Прогресс веса</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #374151)" opacity={0.3} />
                    <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 11, fill: 'var(--text-hint, #9CA3AF)' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'var(--text-hint, #9CA3AF)' }}
                        axisLine={false}
                        tickLine={false}
                        domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip content={<WeightTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#2481cc"
                        strokeWidth={2}
                        dot={{ fill: '#2481cc', r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export function ExerciseVolumeChart({ dates, volumes, className }: {
    dates: string[]
    volumes: (number | null)[]
    className?: string
}) {
    const chartData = useMemo(() => {
        return dates.map((date, index) => ({
            date,
            formattedDate: format(parseISO(date), 'dd MMM', { locale: ru }),
            volume: volumes[index],
        }))
    }, [dates, volumes])

    if (chartData.length === 0) {
        return (
            <div className={cn('h-64 rounded-xl bg-telegram-secondary-bg p-4', className)}>
                <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-telegram-hint">Нет данных для отображения</p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('h-64 rounded-xl bg-telegram-secondary-bg p-4', className)}>
            <h3 className="mb-3 text-sm font-semibold text-telegram-text">Прогресс объёма</h3>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #374151)" opacity={0.3} />
                    <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 11, fill: 'var(--text-hint, #9CA3AF)' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'var(--text-hint, #9CA3AF)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}т` : `${value}`}
                    />
                    <Tooltip content={<VolumeTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#volumeGradient)"
                        connectNulls={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
