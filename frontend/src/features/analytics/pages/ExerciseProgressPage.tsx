import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Activity, ChevronDown, ChevronUp, Dumbbell, TrendingUp, Trophy } from 'lucide-react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { ProgressPeriodFilter } from '@features/analytics/components/ProgressPeriodFilter'
import { ProgressScreenTabs } from '@features/analytics/components/ProgressScreenTabs'
import { PREventCard } from '@features/analytics/components/PREventCard'
import {
    getAnalyticsProgress,
    getAnalyticsProgressInsights,
    getAnalyticsSummary,
    type ApiAnalyticsSummaryResponse,
    type ApiExerciseProgressResponse,
    type ApiProgressInsightsResponse,
} from '@features/analytics/api/analyticsDomain'
import {
    buildChartDataFromProgress,
    mapKeyMetrics,
    mapProgressToExercises,
    type Exercise,
} from '@features/analytics/mappers/analyticsMappers'
import {
    getAnalyticsDateRange,
    PROGRESS_PERIODS,
    type ProgressPeriod,
} from '@features/analytics/lib/progressDateRange'

const LINE_COLORS = ['#2481cc', '#22c55e', '#f97316', '#ef4444', '#a855f7']
const MAX_SELECTED_EXERCISES = 3

function ExerciseChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) {
    if (!active || !payload || payload.length === 0) {
        return null
    }

    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <div className="mt-2 space-y-1">
                {payload.map((item) => (
                    <p key={item.name} className="text-xs text-telegram-hint">
                        <span className="font-medium text-telegram-text">{item.name}</span>: {item.value} кг
                    </p>
                ))}
            </div>
        </div>
    )
}

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload || payload.length === 0) return null

    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">
                Объём: <span className="font-medium text-telegram-text">{payload[0]?.value ?? 0}</span>
            </p>
        </div>
    )
}

export default function ExerciseProgressPage() {
    const [period, setPeriod] = useState<ProgressPeriod>('30d')
    const [expanded, setExpanded] = useState(false)
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>([])

    const range = useMemo(() => getAnalyticsDateRange(period), [period])
    const dateFrom = range.date_from ?? null
    const dateTo = range.date_to ?? null

    const summaryQuery = useQuery<ApiAnalyticsSummaryResponse>({
        queryKey: queryKeys.analytics.summary(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsSummary(range),
        staleTime: 60_000,
    })

    const progressQuery = useQuery<ApiExerciseProgressResponse[]>({
        queryKey: queryKeys.analytics.progress(period, 20, 40, dateFrom, dateTo),
        queryFn: () => getAnalyticsProgress({ ...range, period }),
        staleTime: 60_000,
    })

    const insightsQuery = useQuery<ApiProgressInsightsResponse>({
        queryKey: queryKeys.analytics.progressInsights(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsProgressInsights({ ...range, period }),
        staleTime: 60_000,
    })

    const isLoading = summaryQuery.isPending || progressQuery.isPending || insightsQuery.isPending
    const error = summaryQuery.error ?? progressQuery.error ?? insightsQuery.error
    const progressRows = useMemo(() => progressQuery.data ?? [], [progressQuery.data])
    const exercises = useMemo(() => mapProgressToExercises(progressRows), [progressRows])
    const defaultExerciseIds = useMemo(
        () =>
            [...progressRows]
                .sort((a, b) => (b.summary?.progress_percentage ?? 0) - (a.summary?.progress_percentage ?? 0))
                .slice(0, MAX_SELECTED_EXERCISES)
                .map((row) => row.exercise_id),
        [progressRows],
    )

    const selectedExercises = useMemo<Exercise[]>(() => {
        if (exercises.length === 0) return []

        if (selectedExerciseIds.length === 0) {
            const preferredIds = defaultExerciseIds.length > 0 ? defaultExerciseIds : exercises.slice(0, MAX_SELECTED_EXERCISES).map((exercise) => exercise.id)

            return preferredIds
                .map((exerciseId) => exercises.find((exercise) => exercise.id === exerciseId))
                .filter((exercise): exercise is Exercise => Boolean(exercise))
        }

        const selected = exercises.filter((exercise) => selectedExerciseIds.includes(exercise.id))
        return selected.length > 0 ? selected : exercises.slice(0, Math.min(MAX_SELECTED_EXERCISES, exercises.length))
    }, [defaultExerciseIds, exercises, selectedExerciseIds])

    const chartData = useMemo(
        () => buildChartDataFromProgress({ progressRows, selectedExercises }),
        [progressRows, selectedExercises],
    )

    const keyMetrics = useMemo(
        () => mapKeyMetrics({ summary: summaryQuery.data, progressRows, selectedExercises }),
        [summaryQuery.data, progressRows, selectedExercises],
    )

    const prItems = useMemo(
        () => (insightsQuery.data?.pr_events ?? []).slice(0, 4),
        [insightsQuery.data?.pr_events],
    )

    const bestSets = useMemo(
        () => (insightsQuery.data?.best_sets ?? []).slice(0, 5),
        [insightsQuery.data?.best_sets],
    )

    const volumeTrendData = useMemo(
        () =>
            [...(insightsQuery.data?.volume_trend ?? [])]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-10)
                .map((item) => ({
                    label: format(new Date(item.date), 'dd MMM', { locale: ru }),
                    volume: Math.round(item.total_volume ?? 0),
                })),
        [insightsQuery.data?.volume_trend],
    )

    const exerciseHighlights = useMemo(
        () =>
            [...progressRows]
                .sort((a, b) => (b.summary?.progress_percentage ?? 0) - (a.summary?.progress_percentage ?? 0))
                .map((row) => {
                    const sortedPoints = [...(row.data_points ?? [])].sort((a, b) => a.date.localeCompare(b.date))
                    const latestPoint = sortedPoints[sortedPoints.length - 1]

                    return {
                        id: row.exercise_id,
                        name: row.exercise_name,
                        progress: Math.round(row.summary?.progress_percentage ?? 0),
                        latestWeight: latestPoint?.max_weight ?? null,
                        bestWeight: row.best_performance?.weight ?? null,
                        bestDate: row.best_performance?.date ?? null,
                        pointsCount: row.data_points?.length ?? 0,
                    }
                }),
        [progressRows],
    )

    const noData = !isLoading && progressRows.length === 0

    const toggleExercise = (exerciseId: number) => {
        setSelectedExerciseIds((prev) => {
            if (prev.includes(exerciseId)) {
                return prev.filter((id) => id !== exerciseId)
            }

            if (prev.length >= MAX_SELECTED_EXERCISES) {
                return [...prev.slice(1), exerciseId]
            }

            return [...prev, exerciseId]
        })
    }

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="space-y-3 rounded-3xl bg-telegram-secondary-bg/65 p-4">
                <SectionHeader
                    title="Прогресс упражнений"
                    description="Ключевые движения, рост рабочих весов и свежие PR без перегруженного графика."
                />
                <ProgressScreenTabs />
                <ProgressPeriodFilter value={period} options={PROGRESS_PERIODS} onChange={setPeriod} />
            </section>

            {error ? (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(error)}</p>
            ) : null}

            {isLoading ? (
                <div className="space-y-2">
                    <div className="h-24 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                    <div className="h-56 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                </div>
            ) : null}

            {noData ? (
                <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                    <SectionEmptyState
                        icon={Dumbbell}
                        title="Пока нет динамики по упражнениям"
                        description="Завершите несколько тренировок, чтобы появились графики по весам и лучшие подходы."
                    />
                </div>
            ) : null}

            {!isLoading && !noData ? (
                <>
                    <section className="grid grid-cols-2 gap-2">
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">На графике</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">{selectedExercises.length}</p>
                            <p className="mt-1 text-xs text-telegram-hint">До {MAX_SELECTED_EXERCISES} одновременно</p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">Рост силы</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">+{keyMetrics.strengthGrowth}%</p>
                            <p className="mt-1 text-xs text-telegram-hint">Среднее по выбранным движениям</p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">Тренировок</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">{keyMetrics.totalWorkouts}</p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">PR за период</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">{keyMetrics.personalRecords}</p>
                        </article>
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="flex w-full items-center justify-between"
                        >
                            <div className="text-left">
                                <h2 className="text-sm font-semibold text-telegram-text">Упражнения для сравнения</h2>
                                <p className="mt-1 text-xs text-telegram-hint">Показываем только самое важное: до 3 линий</p>
                            </div>
                            {expanded ? <ChevronUp className="h-4 w-4 text-telegram-hint" /> : <ChevronDown className="h-4 w-4 text-telegram-hint" />}
                        </button>

                        {expanded ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {exercises.map((exercise) => {
                                    const isSelected = selectedExercises.some((item) => item.id === exercise.id)

                                    return (
                                        <button
                                            key={exercise.id}
                                            type="button"
                                            onClick={() => toggleExercise(exercise.id)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                                                isSelected
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-telegram-bg text-telegram-hint'
                                            }`}
                                        >
                                            {exercise.name}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedExercises.map((exercise) => (
                                    <span key={exercise.id} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                                        {exercise.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <h2 className="text-sm font-semibold text-telegram-text">График рабочих весов</h2>
                        <p className="mt-1 text-xs text-telegram-hint">Лучший зафиксированный вес по каждой дате для выбранных упражнений</p>

                        {chartData.length === 0 ? (
                            <p className="mt-4 rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Недостаточно данных для графика за выбранный период.
                            </p>
                        ) : (
                            <>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedExercises.map((exercise, index) => (
                                        <span
                                            key={exercise.id}
                                            className="inline-flex items-center gap-2 rounded-full bg-telegram-bg px-3 py-1.5 text-xs text-telegram-text"
                                        >
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
                                            />
                                            {exercise.name}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-3 h-64 -mx-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 6, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
                                        <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} minTickGap={20} />
                                        <YAxis tick={{ fontSize: 11 }} width={32} />
                                        <Tooltip content={<ExerciseChartTooltip />} />
                                        {selectedExercises.map((exercise, index) => (
                                            <Line
                                                key={exercise.id}
                                                type="monotone"
                                                dataKey={exercise.name}
                                                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                                connectNulls
                                            />
                                        ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Объём нагрузки за период</h2>
                                <p className="mt-1 text-xs text-telegram-hint">Суммарный объём (кг × повт) по тренировочным дням.</p>
                            </div>
                            <Activity className="h-4 w-4 text-primary" />
                        </div>

                        {volumeTrendData.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Недостаточно данных для графика объёма.
                            </p>
                        ) : (
                            <div className="-mx-2 mt-3 h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={volumeTrendData} margin={{ top: 8, right: 16, left: 6, bottom: 8 }}>
                                        <defs>
                                            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                                        <YAxis tick={{ fontSize: 11 }} width={36} />
                                        <Tooltip content={<VolumeTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="volume"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            fill="url(#volumeGradient)"
                                            dot={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Кто растёт быстрее</h2>
                                <p className="mt-1 text-xs text-telegram-hint">Список помогает быстро понять, куда сейчас идёт адаптация.</p>
                            </div>
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>

                        {exerciseHighlights.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Для списка прогрессии пока не хватает повторных записей.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {exerciseHighlights.slice(0, 5).map((item) => (
                                    <article key={item.id} className="rounded-xl bg-telegram-bg p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-telegram-text">{item.name}</p>
                                                <p className="mt-1 text-xs text-telegram-hint">
                                                    {item.pointsCount} точек на графике
                                                    {item.bestDate ? ` • PR ${format(new Date(item.bestDate), 'dd MMM', { locale: ru })}` : ''}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                                +{item.progress}%
                                            </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-lg bg-telegram-secondary-bg/70 px-3 py-2">
                                                <p className="text-telegram-hint">Последний вес</p>
                                                <p className="mt-1 font-semibold text-telegram-text">
                                                    {item.latestWeight != null ? `${item.latestWeight} кг` : 'Нет данных'}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-telegram-secondary-bg/70 px-3 py-2">
                                                <p className="text-telegram-hint">Лучший вес</p>
                                                <p className="mt-1 font-semibold text-telegram-text">
                                                    {item.bestWeight != null ? `${item.bestWeight} кг` : 'Нет данных'}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-telegram-text">Недавние PR</h2>
                            <Trophy className="h-4 w-4 text-amber-500" />
                        </div>
                        {prItems.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Новые рекорды появятся здесь после прогресса в упражнениях.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {prItems.map((item) => (
                                    <PREventCard key={`${item.exercise_id}-${item.date}`} item={item} />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-telegram-text">Лучшие подходы периода</h2>
                                <p className="mt-1 text-xs text-telegram-hint">Топ-сеты по объёму (вес × повторы) для быстрого фокуса.</p>
                            </div>
                            <Trophy className="h-4 w-4 text-amber-500" />
                        </div>
                        {bestSets.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Лучшие подходы появятся после завершённых сетов с весом и повторами.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {bestSets.map((setItem) => (
                                    <article key={`${setItem.exercise_id}-${setItem.date}-${setItem.set_number ?? 0}`} className="rounded-xl bg-telegram-bg p-3">
                                        <p className="text-sm font-medium text-telegram-text">{setItem.exercise_name}</p>
                                        <p className="mt-1 text-xs text-telegram-hint">
                                            {setItem.weight != null ? `${setItem.weight} кг` : 'Без веса'}
                                            {setItem.reps != null ? ` × ${setItem.reps} повт` : ''}
                                            {setItem.set_number != null ? ` • Подход ${setItem.set_number}` : ''}
                                            {` • Объём ${Math.round(setItem.volume)}`}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold text-telegram-text">Что учитывать при чтении графика</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Лучшая польза</p>
                                <p className="mt-1 text-sm font-semibold text-telegram-text">Выбирать 1-3 ключевых движения</p>
                            </article>
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Ограничение</p>
                                <p className="mt-1 text-sm font-semibold text-telegram-text">Сейчас доступен только лучший вес по дате</p>
                            </article>
                        </div>
                    </section>
                </>
            ) : null}
        </div>
    )
}
