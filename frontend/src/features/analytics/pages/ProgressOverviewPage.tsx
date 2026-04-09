import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eachDayOfInterval, format, parseISO, startOfWeek, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Activity, CalendarDays, Dumbbell, Flame, Trophy, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import {
    getAnalyticsPerformanceOverview,
    getAnalyticsMuscleLoad,
    getAnalyticsProgress,
    getAnalyticsProgressInsights,
    getAnalyticsSummary,
    type ApiAnalyticsPerformanceOverviewResponse,
    type ApiAnalyticsSummaryResponse,
    type ApiExerciseProgressResponse,
    type ApiMuscleLoadEntry,
    type ApiProgressInsightsResponse,
} from '@features/analytics/api/analyticsDomain'
import { ProgressConsistencyStrip } from '@features/analytics/components/ProgressConsistencyStrip'
import { ProgressPeriodFilter } from '@features/analytics/components/ProgressPeriodFilter'
import { ProgressStatCard } from '@features/analytics/components/ProgressStatCard'
import { ProgressTrendBars } from '@features/analytics/components/ProgressTrendBars'
import { ProgressScreenTabs } from '@features/analytics/components/ProgressScreenTabs'
import { PREventCard } from '@features/analytics/components/PREventCard'
import {
    getAnalyticsDateRange,
    PROGRESS_PERIODS,
    type ProgressPeriod,
} from '@features/analytics/lib/progressDateRange'
import { SectionHeader } from '@shared/ui/SectionHeader'

function formatMinutes(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return '0 мин'
    if (minutes < 60) return `${Math.round(minutes)} мин`
    const hours = Math.floor(minutes / 60)
    const rest = Math.round(minutes % 60)
    return rest > 0 ? `${hours}ч ${rest}м` : `${hours}ч`
}

function formatMetric(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value))
}

function OneRMTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
}) {
    if (!active || !payload || payload.length === 0) return null
    const value = Number(payload[0]?.value ?? 0)
    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">Оценка 1ПМ: {value.toFixed(1)} кг</p>
        </div>
    )
}

export default function ProgressOverviewPage() {
    const [period, setPeriod] = useState<ProgressPeriod>('30d')
    const range = useMemo(() => getAnalyticsDateRange(period), [period])
    const dateFrom = range.date_from ?? null
    const dateTo = range.date_to ?? null

    const summaryQuery = useQuery<ApiAnalyticsSummaryResponse>({
        queryKey: queryKeys.analytics.summary(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsSummary(range),
        staleTime: 60_000,
    })

    const performanceOverviewQuery = useQuery<ApiAnalyticsPerformanceOverviewResponse>({
        queryKey: queryKeys.analytics.performanceOverview(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsPerformanceOverview({ ...range, period }),
        staleTime: 60_000,
    })

    const progressQuery = useQuery<ApiExerciseProgressResponse[]>({
        queryKey: queryKeys.analytics.progress(period, 12, 20, dateFrom, dateTo),
        queryFn: () => getAnalyticsProgress({ ...range, period }),
        staleTime: 60_000,
    })

    const insightsQuery = useQuery<ApiProgressInsightsResponse>({
        queryKey: queryKeys.analytics.progressInsights(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsProgressInsights({ ...range, period }),
        staleTime: 60_000,
    })

    const muscleLoadQuery = useQuery<ApiMuscleLoadEntry[]>({
        queryKey: queryKeys.analytics.muscleLoad(dateFrom, dateTo),
        queryFn: () => getAnalyticsMuscleLoad(range),
        staleTime: 60_000,
    })

    const isLoading =
        summaryQuery.isPending ||
        performanceOverviewQuery.isPending ||
        progressQuery.isPending ||
        insightsQuery.isPending ||
        muscleLoadQuery.isPending

    const hasError =
        summaryQuery.error ||
        performanceOverviewQuery.error ||
        progressQuery.error ||
        insightsQuery.error ||
        muscleLoadQuery.error

    const summary = summaryQuery.data
    const performanceOverview = performanceOverviewQuery.data
    const insights = insightsQuery.data
    const progressRows = useMemo(() => progressQuery.data ?? [], [progressQuery.data])
    const muscleRows = useMemo(() => muscleLoadQuery.data ?? [], [muscleLoadQuery.data])
    const totalPersonalRecords = insights?.pr_events?.length ?? 0

    const topImprovingExercises = useMemo(
        () =>
            [...progressRows]
                .filter((row) => typeof row.summary?.progress_percentage === 'number')
                .sort((a, b) => (b.summary?.progress_percentage ?? 0) - (a.summary?.progress_percentage ?? 0))
                .slice(0, 4)
                .map((row) => ({
                    label: row.exercise_name,
                    value: Math.max(0, Math.round(row.summary?.progress_percentage ?? 0)),
                })),
        [progressRows],
    )

    const volumeTrend = useMemo(
        () =>
            [...(performanceOverview?.trend ?? [])]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-8)
                .map((item) => ({
                    label: format(new Date(item.date), 'dd MMM', { locale: ru }),
                    value: Math.max(0, Math.round(item.total_volume ?? 0)),
                })),
        [performanceOverview?.trend],
    )

    const estimatedOneRmTrend = useMemo(
        () =>
            [...(performanceOverview?.trend ?? [])]
                .filter((item) => typeof item.best_estimated_1rm === 'number')
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-12)
                .map((item) => ({
                    label: format(new Date(item.date), 'dd MMM', { locale: ru }),
                    value: Number(item.best_estimated_1rm ?? 0),
                })),
        [performanceOverview?.trend],
    )

    const muscleDistribution = useMemo(() => {
        const acc = new Map<string, number>()
        for (const row of muscleRows) {
            const key = row.muscleGroup || 'Прочее'
            acc.set(key, (acc.get(key) ?? 0) + (row.loadScore ?? 0))
        }

        return [...acc.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, value]) => ({ label, value: Math.round(value) }))
    }, [muscleRows])

    const frequencyTrend = useMemo(() => {
        const source = insights?.frequency_trend ?? []
        if (source.length > 0) {
            return source.map((item) => ({
                label: format(new Date(item.week_start), 'd MMM', { locale: ru }),
                value: item.active_days,
            }))
        }

        return Array.from({ length: 4 }, (_, offset) => {
            const weekStart = startOfWeek(subDays(new Date(), (3 - offset) * 7), { weekStartsOn: 1 })
            const weekDates = eachDayOfInterval({ start: weekStart, end: subDays(weekStart, -6) })
            return {
                label: format(weekStart, 'd MMM', { locale: ru }),
                value: weekDates.length > 0 ? 0 : 0,
            }
        })
    }, [insights?.frequency_trend])

    const consistencyDays = useMemo(() => {
        const activeDates = new Set((insights?.volume_trend ?? []).map((item) => item.date))

        return eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() }).map((day) => {
            const iso = format(day, 'yyyy-MM-dd')

            return {
                date: iso,
                label: format(day, 'EEEEE', { locale: ru }),
                isActive: activeDates.has(iso),
            }
        })
    }, [insights?.volume_trend])

    const progressionHighlights = useMemo(
        () =>
            [...progressRows]
                .filter((row) => typeof row.summary?.progress_percentage === 'number')
                .sort((a, b) => (b.summary?.progress_percentage ?? 0) - (a.summary?.progress_percentage ?? 0))
                .slice(0, 3)
                .map((row) => {
                    const sortedPoints = [...(row.data_points ?? [])].sort((a, b) => a.date.localeCompare(b.date))
                    const latestPoint = sortedPoints[sortedPoints.length - 1]

                    return {
                        id: row.exercise_id,
                        name: row.exercise_name,
                        progress: Math.round(row.summary?.progress_percentage ?? 0),
                        latestWeight: latestPoint?.max_weight,
                        bestWeight: row.best_performance?.weight ?? null,
                        bestDate: row.best_performance?.date ?? null,
                    }
                }),
        [progressRows],
    )

    const recentPRs = useMemo(
        () => [...(insights?.pr_events ?? [])].slice(0, 4),
        [insights?.pr_events],
    )

    const noData =
        !isLoading &&
        (summary?.total_workouts ?? 0) === 0 &&
        topImprovingExercises.length === 0 &&
        volumeTrend.length === 0

    const averageSessionsPerWeek =
        typeof performanceOverview?.average_workouts_per_week === 'number' &&
        performanceOverview.average_workouts_per_week > 0
            ? Number(performanceOverview.average_workouts_per_week.toFixed(1))
            : typeof insights?.summary?.average_workouts_per_week === 'number' && insights.summary.average_workouts_per_week > 0
              ? Number(insights.summary.average_workouts_per_week.toFixed(1))
            : (typeof summary?.weekly_average === 'number' ? Number(summary.weekly_average.toFixed(1)) : 0)
    const activeDaysCount = insights?.summary?.active_days ?? 0
    const heroTitle =
        (summary?.current_streak ?? 0) >= 5
            ? 'Хороший темп'
            : (summary?.total_workouts ?? 0) >= 1
              ? 'Прогресс идёт'
              : 'Начните первую серию'

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="space-y-3 rounded-3xl bg-telegram-secondary-bg/65 p-4">
                <SectionHeader
                    title="Прогресс"
                    description="Короткие срезы, PR и консистентность без перегруза графиками."
                />
                <ProgressScreenTabs />
                <ProgressPeriodFilter value={period} options={PROGRESS_PERIODS} onChange={setPeriod} />
            </section>

            {hasError ? (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                    {getErrorMessage(hasError)}
                </p>
            ) : null}

            {isLoading ? (
                <div className="space-y-2">
                    <div className="h-24 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                    <div className="h-24 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                    <div className="h-24 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                </div>
            ) : null}

            {noData ? (
                <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                    <SectionEmptyState
                        icon={Activity}
                        title="Пока нет данных по прогрессу"
                        description="Завершите несколько тренировок и отмечайте подходы. Здесь появятся тренды объёма, PR и динамика упражнений."
                    />
                </div>
            ) : null}

            {!isLoading && !noData ? (
                <>
                    <section className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{heroTitle}</p>
                                <h2 className="mt-2 text-xl font-semibold text-telegram-text">
                                    {summary?.total_workouts ?? 0} тренировок за период
                                </h2>
                                <p className="mt-1 text-sm text-telegram-hint">
                                    {averageSessionsPerWeek} в неделю, {activeDaysCount} активных дней и {totalPersonalRecords} новых PR.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-telegram-secondary-bg px-3 py-2 text-right">
                                <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Серия</p>
                                <p className="mt-1 text-2xl font-semibold leading-none text-telegram-text">
                                    {summary?.current_streak ?? 0}
                                </p>
                                <p className="mt-1 text-xs text-telegram-hint">дней подряд</p>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-2">
                        <ProgressStatCard
                            icon={Dumbbell}
                            label="Тренировки"
                            value={String(summary?.total_workouts ?? 0)}
                            hint="За выбранный период"
                        />
                        <ProgressStatCard
                            icon={CalendarDays}
                            label="Частота"
                            value={`${averageSessionsPerWeek}`}
                            hint="Среднее в неделю"
                            tone="default"
                        />
                        <ProgressStatCard
                            icon={Flame}
                            label="Серия"
                            value={`${summary?.current_streak ?? 0} дн`}
                            hint={`Максимум ${summary?.longest_streak ?? 0} дн`}
                            tone="success"
                        />
                        <ProgressStatCard
                            icon={Trophy}
                            label="PR"
                            value={String(totalPersonalRecords)}
                            hint="Личных рекордов"
                            tone="warning"
                        />
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Ритм за последние 14 дней</h2>
                                <p className="mt-1 text-xs text-telegram-hint">
                                    Быстро видно, где держится привычка и где были паузы.
                                </p>
                            </div>
                            <div className="rounded-xl bg-telegram-bg px-3 py-2 text-right">
                                <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Активных дней</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {consistencyDays.filter((day) => day.isActive).length}/14
                                </p>
                            </div>
                        </div>
                        <ProgressConsistencyStrip days={consistencyDays} className="mt-4" />
                    </section>

                    <ProgressTrendBars
                        title="Частота тренировок"
                        subtitle="Сколько дней с тренировками было в каждой неделе"
                        items={frequencyTrend}
                        valueFormatter={(value) => `${value} дн`}
                        emptyMessage="Частота появится после первых завершённых тренировок."
                    />

                    <ProgressTrendBars
                        title="Тренд объёма"
                        subtitle="Последние тренировочные дни"
                        items={volumeTrend}
                        valueFormatter={(value) => `${formatMetric(value)} ед.`}
                        emptyMessage="Недостаточно данных по объёму."
                    />

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Прогресс силы (оценка 1ПМ)</h2>
                                <p className="mt-1 text-xs text-telegram-hint">
                                    Расчёт по лучшему подходу дня: {`1ПМ = вес × (1 + повторы / 30)`}.
                                </p>
                            </div>
                            <div className="rounded-xl bg-telegram-bg px-3 py-2 text-right">
                                <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Текущий 1ПМ</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {performanceOverview?.current_estimated_1rm != null
                                        ? `${performanceOverview.current_estimated_1rm.toFixed(1)} кг`
                                        : '—'}
                                </p>
                                <p className="mt-1 text-xs text-telegram-hint">
                                    {performanceOverview?.estimated_1rm_progress_pct != null
                                        ? `${performanceOverview.estimated_1rm_progress_pct > 0 ? '+' : ''}${performanceOverview.estimated_1rm_progress_pct.toFixed(1)}%`
                                        : 'нет базового значения'}
                                </p>
                            </div>
                        </div>

                        {estimatedOneRmTrend.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Пока недостаточно данных по весам/повторам для расчёта 1ПМ.
                            </p>
                        ) : (
                            <div className="-mx-2 h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={estimatedOneRmTrend} margin={{ top: 8, right: 14, left: 6, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                                        <YAxis tick={{ fontSize: 11 }} width={44} />
                                        <Tooltip content={<OneRMTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            dot={{ r: 2.5 }}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Прогрессия упражнений</h2>
                                <p className="mt-1 text-xs text-telegram-hint">Лидеры роста по рабочему весу за выбранный период.</p>
                            </div>
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>

                        {progressionHighlights.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Как только появятся повторные подходы по упражнениям, здесь будет виден рост.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {progressionHighlights.map((item) => (
                                    <article key={item.id} className="rounded-xl bg-telegram-bg p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-telegram-text">{item.name}</p>
                                                <p className="mt-1 text-xs text-telegram-hint">
                                                    Последний вес {item.latestWeight != null ? `${item.latestWeight} кг` : 'нет данных'}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                                +{item.progress}%
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-telegram-hint">
                                            Лучший результат {item.bestWeight != null ? `${item.bestWeight} кг` : 'пока без веса'}
                                            {item.bestDate ? ` • ${format(parseISO(item.bestDate), 'dd MMM', { locale: ru })}` : ''}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <ProgressTrendBars
                        title="Нагрузка по мышечным группам"
                        subtitle="Какие зоны получали больше всего стресса"
                        items={muscleDistribution}
                        valueFormatter={(value) => `${formatMetric(value)} ед.`}
                        emptyMessage="Нет данных по мышечным группам."
                    />

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-telegram-text">Недавние PR</h2>
                            <Trophy className="h-4 w-4 text-amber-500" />
                        </div>
                        {recentPRs.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Как только появятся новые рекорды, они отобразятся здесь.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {recentPRs.map((row) => (
                                    <PREventCard key={`${row.exercise_id}-${row.date}`} item={row} />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <h2 className="text-sm font-semibold text-telegram-text">Общее ощущение периода</h2>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Суммарное время</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {formatMinutes(summary?.total_duration ?? 0)}
                                </p>
                            </article>
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Среднее в месяц</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {summary?.monthly_average ?? 0}
                                </p>
                            </article>
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Суммарный объём</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {formatMetric(performanceOverview?.total_volume ?? insights?.summary?.total_volume ?? 0)}
                                </p>
                            </article>
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Объём на тренировку</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {formatMetric(performanceOverview?.average_volume_per_workout ?? 0)}
                                </p>
                            </article>
                        </div>
                    </section>
                </>
            ) : null}
        </div>
    )
}
