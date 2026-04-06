import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Activity, CalendarDays, Dumbbell, Flame, Trophy, TrendingUp } from 'lucide-react'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import {
    getAnalyticsMuscleLoad,
    getAnalyticsProgress,
    getAnalyticsSummary,
    getAnalyticsTrainingLoadDaily,
    type ApiAnalyticsSummaryResponse,
    type ApiExerciseProgressResponse,
    type ApiMuscleLoadEntry,
    type ApiTrainingLoadDailyEntry,
} from '@features/analytics/api/analyticsDomain'
import { ProgressStatCard } from '@features/analytics/components/ProgressStatCard'
import { ProgressTrendBars } from '@features/analytics/components/ProgressTrendBars'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIODS: Array<{ id: Period; label: string }> = [
    { id: '7d', label: '7д' },
    { id: '30d', label: '30д' },
    { id: '90d', label: '90д' },
    { id: 'all', label: 'Все' },
]

function getDateRange(period: Period): { date_from?: string; date_to?: string } {
    if (period === 'all') return {}

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    return {
        date_from: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
        date_to: format(new Date(), 'yyyy-MM-dd'),
    }
}

function formatMinutes(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return '0 мин'
    if (minutes < 60) return `${Math.round(minutes)} мин`
    const hours = Math.floor(minutes / 60)
    const rest = Math.round(minutes % 60)
    return rest > 0 ? `${hours}ч ${rest}м` : `${hours}ч`
}

export default function ProgressOverviewPage() {
    const [period, setPeriod] = useState<Period>('30d')
    const range = useMemo(() => getDateRange(period), [period])
    const dateFrom = range.date_from ?? null
    const dateTo = range.date_to ?? null

    const summaryQuery = useQuery<ApiAnalyticsSummaryResponse>({
        queryKey: queryKeys.analytics.summary(period, dateFrom, dateTo),
        queryFn: () => getAnalyticsSummary(range),
        staleTime: 60_000,
    })

    const progressQuery = useQuery<ApiExerciseProgressResponse[]>({
        queryKey: queryKeys.analytics.progress(period, 12, 20, dateFrom, dateTo),
        queryFn: () => getAnalyticsProgress({ ...range, period }),
        staleTime: 60_000,
    })

    const trainingLoadQuery = useQuery<ApiTrainingLoadDailyEntry[]>({
        queryKey: queryKeys.analytics.trainingLoadDaily(dateFrom, dateTo),
        queryFn: () => getAnalyticsTrainingLoadDaily(range),
        staleTime: 60_000,
    })

    const muscleLoadQuery = useQuery<ApiMuscleLoadEntry[]>({
        queryKey: queryKeys.analytics.muscleLoad(dateFrom, dateTo),
        queryFn: () => getAnalyticsMuscleLoad(range),
        staleTime: 60_000,
    })

    const isLoading =
        summaryQuery.isPending || progressQuery.isPending || trainingLoadQuery.isPending || muscleLoadQuery.isPending

    const hasError = summaryQuery.error || progressQuery.error || trainingLoadQuery.error || muscleLoadQuery.error

    const summary = summaryQuery.data
    const progressRows = progressQuery.data ?? []
    const trainingRows = trainingLoadQuery.data ?? []
    const muscleRows = muscleLoadQuery.data ?? []

    const topImprovingExercises = useMemo(
        () =>
            [...progressRows]
                .filter((row) => typeof row.summary?.progress_percentage === 'number')
                .sort((a, b) => (b.summary?.progress_percentage ?? 0) - (a.summary?.progress_percentage ?? 0))
                .slice(0, 5)
                .map((row) => ({
                    label: row.exercise_name,
                    value: Math.max(0, Math.round(row.summary?.progress_percentage ?? 0)),
                })),
        [progressRows],
    )

    const volumeTrend = useMemo(
        () =>
            [...trainingRows]
                .slice(-8)
                .map((item) => ({
                    label: format(new Date(item.date), 'dd MMM', { locale: ru }),
                    value: Math.max(0, Math.round(item.volume ?? 0)),
                })),
        [trainingRows],
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

    const recentPRs = useMemo(
        () =>
            progressRows
                .filter((row) => row.best_performance?.date)
                .sort((a, b) => (b.best_performance?.date ?? '').localeCompare(a.best_performance?.date ?? ''))
                .slice(0, 4),
        [progressRows],
    )

    const noData =
        !isLoading &&
        (summary?.total_workouts ?? 0) === 0 &&
        topImprovingExercises.length === 0 &&
        volumeTrend.length === 0

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-lg font-semibold text-telegram-text">Прогресс</h1>
                    <p className="text-xs text-telegram-hint">Короткие срезы для зала</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    {PERIODS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setPeriod(item.id)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                                period === item.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-secondary-bg text-telegram-hint'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
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
                    <section className="grid grid-cols-2 gap-2">
                        <ProgressStatCard
                            icon={Dumbbell}
                            label="Тренировки"
                            value={String(summary?.total_workouts ?? 0)}
                            hint="За выбранный период"
                        />
                        <ProgressStatCard
                            icon={CalendarDays}
                            label="Серия"
                            value={`${summary?.current_streak ?? 0} дн`}
                            hint="Текущий стрик"
                            tone="success"
                        />
                        <ProgressStatCard
                            icon={Flame}
                            label="Объём"
                            value={formatMinutes(summary?.total_duration ?? 0)}
                            hint="Суммарное время"
                        />
                        <ProgressStatCard
                            icon={Trophy}
                            label="PR"
                            value={String(summary?.personal_records?.length ?? 0)}
                            hint="Личных рекордов"
                            tone="warning"
                        />
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <h2 className="text-sm font-semibold text-telegram-text">Консистентность</h2>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Среднее в неделю</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">{summary?.weekly_average ?? 0}</p>
                            </div>
                            <div className="rounded-xl bg-telegram-bg p-3">
                                <p className="text-xs text-telegram-hint">Среднее в месяц</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">{summary?.monthly_average ?? 0}</p>
                            </div>
                        </div>
                    </section>

                    <ProgressTrendBars
                        title="Тренд объёма"
                        subtitle="Последние 8 сессий"
                        items={volumeTrend}
                        valueFormatter={(value) => `${value}`}
                        emptyMessage="Недостаточно данных по объёму."
                    />

                    <ProgressTrendBars
                        title="Топ прогрессирующих упражнений"
                        subtitle="Рост по рабочим весам"
                        items={topImprovingExercises}
                        valueFormatter={(value) => `+${value}%`}
                        emptyMessage="Нет упражнений с измеримым ростом в этом периоде."
                    />

                    <ProgressTrendBars
                        title="Распределение по мышечным группам"
                        subtitle="Куда уходит нагрузка"
                        items={muscleDistribution}
                        emptyMessage="Нет данных по мышечным группам."
                    />

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-telegram-text">Недавние PR</h2>
                            <TrendingUp className="h-4 w-4 text-telegram-hint" />
                        </div>
                        {recentPRs.length === 0 ? (
                            <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Как только появятся новые рекорды, они отобразятся здесь.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {recentPRs.map((row) => (
                                    <article key={`${row.exercise_name}-${row.best_performance?.date}`} className="rounded-xl bg-telegram-bg p-3">
                                        <p className="text-sm font-medium text-telegram-text">{row.exercise_name}</p>
                                        <p className="mt-1 text-xs text-telegram-hint">
                                            {row.best_performance?.weight != null
                                                ? `${row.best_performance.weight} кг`
                                                : 'Без веса'}
                                            {row.best_performance?.reps != null ? ` × ${row.best_performance.reps} повт` : ''}
                                            {row.best_performance?.date ? ` • ${format(new Date(row.best_performance.date), 'dd MMM', { locale: ru })}` : ''}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            ) : null}
        </div>
    )
}
