/**
 * Реальные замеры тела на экране здоровья (WS2-1).
 *
 * Компонент не владеет сетью: данные приходят пропсами, запрос делает страница.
 * Пустой ответ — это не ошибка, поэтому пустое состояние объясняет, где взять данные.
 */
import { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Minus, RefreshCw, Ruler, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { BodyMeasurement, BodyMeasurementType } from '@features/health/types/metrics'
import {
    defaultMeasurementType,
    formatDelta,
    hasTrend,
    summarizeMeasurements,
} from '@features/health/lib/bodyMeasurementSeries'

interface BodyMeasurementsCardProps {
    items: BodyMeasurement[]
    isLoading?: boolean
    isError?: boolean
    onRetry?: () => void
    className?: string
}

const DELTA_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus } as const
const DELTA_COLORS = {
    up: 'text-danger',
    down: 'text-success',
    flat: 'text-telegram-hint',
} as const

export function BodyMeasurementsCard({
    items,
    isLoading = false,
    isError = false,
    onRetry,
    className,
}: BodyMeasurementsCardProps) {
    const summaries = useMemo(() => summarizeMeasurements(items), [items])
    const [selected, setSelected] = useState<BodyMeasurementType | null>(null)
    const activeType = selected ?? defaultMeasurementType(summaries)
    const active = summaries.find((summary) => summary.type === activeType) ?? null

    if (isLoading) {
        return (
            <div className={cn('space-y-3', className)} data-testid="body-measurements-loading">
                <div className="h-6 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-700" />
                <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-neutral-700" />
            </div>
        )
    }

    if (isError) {
        return (
            <div
                className={cn(
                    'rounded-xl bg-gray-50 p-4 text-center dark:bg-neutral-800',
                    className,
                )}
                data-testid="body-measurements-error"
            >
                <p className="text-sm text-telegram-hint">
                    Не удалось загрузить замеры тела. Проверьте соединение и повторите.
                </p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Повторить
                    </button>
                )}
            </div>
        )
    }

    if (summaries.length === 0) {
        return (
            <div
                className={cn(
                    'rounded-xl bg-gray-50 p-4 text-center dark:bg-neutral-800',
                    className,
                )}
                data-testid="body-measurements-empty"
            >
                <Ruler className="mx-auto h-6 w-6 text-telegram-hint" />
                <p className="mt-2 text-sm text-telegram-hint">
                    Замеров пока нет. Добавьте грудь, талию или бёдра в профиле — здесь появится
                    динамика.
                </p>
            </div>
        )
    }

    return (
        <div className={cn('space-y-4', className)} data-testid="body-measurements-card">
            <div className="grid grid-cols-2 gap-3">
                {summaries.map((summary) => {
                    const delta = formatDelta(summary.deltaCm)
                    const DeltaIcon = delta ? DELTA_ICONS[delta.direction] : null
                    return (
                        <button
                            key={summary.type}
                            type="button"
                            onClick={() => setSelected(summary.type)}
                            data-testid={`measurement-${summary.type}`}
                            className={cn(
                                'rounded-xl bg-gray-50 p-3 text-left transition-all active:scale-[0.98] dark:bg-neutral-800',
                                summary.type === activeType && 'ring-2 ring-primary',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-telegram-hint">{summary.label}</span>
                                {delta && DeltaIcon && (
                                    <span
                                        className={cn(
                                            'flex items-center gap-1 text-xs',
                                            DELTA_COLORS[delta.direction],
                                        )}
                                    >
                                        <DeltaIcon className="h-3 w-3" />
                                        {delta.text}
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 text-xl font-bold text-telegram-text">
                                {summary.latest.value}
                                <span className="ml-1 text-xs font-normal text-telegram-hint">
                                    см
                                </span>
                            </div>
                            <div className="text-xs text-telegram-hint">
                                {summary.latest.label}
                            </div>
                        </button>
                    )
                })}
            </div>

            {active && (
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-neutral-800">
                    <h3 className="text-sm font-semibold text-telegram-text">
                        Динамика: {active.label}
                    </h3>
                    {hasTrend(active.points) ? (
                        <div className="mt-3 h-40" data-testid="body-measurements-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={active.points}>
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 11 }}
                                        stroke="currentColor"
                                        className="text-telegram-hint"
                                    />
                                    <YAxis
                                        domain={['dataMin - 1', 'dataMax + 1']}
                                        tick={{ fontSize: 11 }}
                                        width={32}
                                        stroke="currentColor"
                                        className="text-telegram-hint"
                                    />
                                    <Tooltip
                                        formatter={(value) => [`${value} см`, active.label]}
                                        labelFormatter={(label) => `Дата: ${label}`}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="var(--color-primary, #2AABEE)"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-telegram-hint" data-testid="measurement-single-point">
                            Пока один замер ({active.latest.label}, {active.latest.value} см) — линия
                            появится после второго измерения.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
