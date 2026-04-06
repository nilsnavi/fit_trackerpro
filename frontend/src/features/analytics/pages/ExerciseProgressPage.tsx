import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Dumbbell, TrendingUp, Trophy } from 'lucide-react'
import {
    Line,
    LineChart,
    ResponsiveContainer,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from 'recharts'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { ProgressScreenTabs } from '@features/analytics/components/ProgressScreenTabs'
import {
    getAnalyticsProgress,
    getAnalyticsSummary,
    type ApiAnalyticsSummaryResponse,
    type ApiExerciseProgressResponse,
} from '@features/analytics/api/analyticsDomain'
import {
    buildChartDataFromProgress,
    mapKeyMetrics,
    mapProgressToExercises,
    type Exercise,
} from '@features/analytics/mappers/analyticsMappers'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIODS: Array<{ id: Period; label: string }> = [
    { id: '7d', label: '7д' },
    { id: '30d', label: '30д' },
    { id: '90d', label: '90д' },
    { id: 'all', label: 'Все' },
]

const LINE_COLORS = ['#2481cc', '#22c55e', '#f97316', '#ef4444', '#a855f7']

function getDateRange(period: Period): { date_from?: string; date_to?: string } {
    if (period === 'all') return {}

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - (days - 1))

    return {
        date_from: format(start, 'yyyy-MM-dd'),
        date_to: format(end, 'yyyy-MM-dd'),
    }
}

export default function ExerciseProgressPage() {
    const [period, setPeriod] = useState<Period>('30d')
    const [expanded, setExpanded] = useState(false)
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>([])

    const range = useMemo(() => getDateRange(period), [period])
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

    const isLoading = summaryQuery.isPending || progressQuery.isPending
    const error = summaryQuery.error ?? progressQuery.error
    const progressRows = progressQuery.data ?? []
    const exercises = useMemo(() => mapProgressToExercises(progressRows), [progressRows])

    const selectedExercises = useMemo<Exercise[]>(() => {
        if (exercises.length === 0) return []

        if (selectedExerciseIds.length === 0) {
            return exercises.slice(0, Math.min(3, exercises.length))
        }

        const selected = exercises.filter((exercise) => selectedExerciseIds.includes(exercise.id))
        return selected.length > 0 ? selected : exercises.slice(0, Math.min(3, exercises.length))
    }, [exercises, selectedExerciseIds])

    const chartData = useMemo(
        () => buildChartDataFromProgress({ progressRows, selectedExercises }),
        [progressRows, selectedExercises],
    )

    const keyMetrics = useMemo(
        () => mapKeyMetrics({ summary: summaryQuery.data, progressRows, selectedExercises }),
        [summaryQuery.data, progressRows, selectedExercises],
    )

    const prItems = useMemo(
        () =>
            progressRows
                .filter((item) => item.best_performance?.date)
                .sort((a, b) => (b.best_performance?.date ?? '').localeCompare(a.best_performance?.date ?? ''))
                .slice(0, 4),
        [progressRows],
    )

    const noData = !isLoading && progressRows.length === 0

    const toggleExercise = (exerciseId: number) => {
        setSelectedExerciseIds((prev) => {
            if (prev.includes(exerciseId)) {
                return prev.filter((id) => id !== exerciseId)
            }

            if (prev.length >= 5) {
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
                    description="Отслеживайте рабочие веса, PR и динамику по ключевым движениям."
                />
                <ProgressScreenTabs />
                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    {PERIODS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setPeriod(item.id)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                                period === item.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-bg text-telegram-hint'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
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
                            <p className="text-xs text-telegram-hint">Выбрано упражнений</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">{selectedExercises.length}</p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">Рост силы</p>
                            <p className="mt-1 text-xl font-semibold text-telegram-text">+{keyMetrics.strengthGrowth}%</p>
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
                                <p className="mt-1 text-xs text-telegram-hint">До 5 упражнений одновременно</p>
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
                        <p className="mt-1 text-xs text-telegram-hint">Лучший вес на дату для выбранных упражнений</p>

                        {chartData.length === 0 ? (
                            <p className="mt-4 rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Недостаточно данных для графика за выбранный период.
                            </p>
                        ) : (
                            <div className="mt-3 h-64 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
                                        <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} minTickGap={20} />
                                        <YAxis tick={{ fontSize: 11 }} width={36} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
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
                                    <article key={`${item.exercise_id}-${item.best_performance?.date}`} className="rounded-xl bg-telegram-bg p-3">
                                        <p className="text-sm font-medium text-telegram-text">{item.exercise_name}</p>
                                        <p className="mt-1 text-xs text-telegram-hint">
                                            {item.best_performance?.weight != null ? `${item.best_performance.weight} кг` : 'Без веса'}
                                            {item.best_performance?.reps != null ? ` × ${item.best_performance.reps} повт` : ''}
                                            {item.best_performance?.date ? ` • ${format(new Date(item.best_performance.date), 'dd MMM', { locale: ru })}` : ''}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold text-telegram-text">Краткая статистика</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Тренировок</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">{keyMetrics.totalWorkouts}</p>
                            </article>
                            <article className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Личных рекордов</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">{keyMetrics.personalRecords}</p>
                            </article>
                        </div>
                    </section>
                </>
            ) : null}
        </div>
    )
}
