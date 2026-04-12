import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
    Activity,
    Award,
    CalendarDays,
    Flame,
    Gauge,
    HeartPulse,
    Sparkles,
    Target,
    Timer,
    Trophy,
} from 'lucide-react'
import { useAnalytics, type AnalyticsDashboardPeriod } from '@/hooks/useAnalytics'
import { useAchievements } from '@/hooks/useAchievements'
import { useChallenges } from '@/hooks/useChallenges'
import { healthApi } from '@shared/api/domains/healthApi'
import { getErrorMessage } from '@shared/errors'
import { cn } from '@shared/lib/cn'
import { Button } from '@shared/ui/Button'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { ProgressScreenTabs } from '@features/analytics/components/ProgressScreenTabs'
import { ProgressTrendBars } from '@features/analytics/components/ProgressTrendBars'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

const PERIOD_OPTIONS: { id: AnalyticsDashboardPeriod; label: string }[] = [
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'all', label: 'Всё время' },
]

function healthStatsPeriod(period: AnalyticsDashboardPeriod): string {
    if (period === 'week') return '7d'
    if (period === 'month') return '30d'
    return '1y'
}

function formatMinutes(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return '0 мин'
    if (minutes < 60) return `${Math.round(minutes)} мин`
    const hours = Math.floor(minutes / 60)
    const rest = Math.round(minutes % 60)
    return rest > 0 ? `${hours}ч ${rest}м` : `${hours}ч`
}

function formatAvgRestSeconds(sec: number | null | undefined): string {
    if (sec == null || !Number.isFinite(sec)) return '—'
    const m = Math.floor(sec / 60)
    const s = Math.max(0, Math.round(sec - m * 60))
    if (m <= 0) return `${s} сек`
    return `${m} мин ${s} сек`
}

function formatRpeTrendLabel(trend: string | null | undefined): string {
    if (trend === 'up') return 'выше прошлого периода'
    if (trend === 'down') return 'ниже прошлого периода'
    if (trend === 'flat') return 'как в прошлом периоде'
    return ''
}

export default function AnalyticsDashboardPage() {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()
    const [period, setPeriod] = useState<AnalyticsDashboardPeriod>('week')
    const analyticsQuery = useAnalytics(period)
    const achievementsQuery = useAchievements()
    const challengesQuery = useChallenges()
    const healthQuery = useQuery({
        queryKey: ['health', 'dashboardStats', healthStatsPeriod(period), period],
        queryFn: () => healthApi.getDashboardStats(healthStatsPeriod(period)),
        staleTime: 60_000,
    })

    const chartItems = useMemo(() => {
        const rows = analyticsQuery.data?.weekly_chart ?? []
        return rows.map((row) => ({
            label: format(parseISO(row.date), 'd MMM', { locale: ru }),
            value: row.count,
        }))
    }, [analyticsQuery.data?.weekly_chart])

    const intensityChartItems = useMemo(() => {
        const rows = analyticsQuery.data?.intensity_weekly_chart ?? []
        return rows
            .filter((row) => row.intensity_score != null && Number.isFinite(row.intensity_score))
            .map((row) => ({
                label: format(parseISO(row.date), 'd MMM', { locale: ru }),
                value: row.intensity_score ?? 0,
            }))
    }, [analyticsQuery.data?.intensity_weekly_chart])

    const rpeWorkoutsCount = analyticsQuery.data?.workouts_with_rpe_count ?? 0
    const showIntensityRpeHint = rpeWorkoutsCount < 3
    const showIntensityScoreChart = intensityChartItems.length >= 2

    const earnedAchievements = useMemo(() => {
        const data = achievementsQuery.data
        const items = data?.items ?? []
        const completed = [...items]
            .filter((a) => a.is_completed)
            .sort((a, b) => b.earned_at.localeCompare(a.earned_at))
        if (completed.length > 0) return completed
        const recent = data?.recent_achievements ?? []
        return [...recent].sort((a, b) => b.earned_at.localeCompare(a.earned_at))
    }, [achievementsQuery.data])

    const isMainLoading = analyticsQuery.isPending
    const mainError = analyticsQuery.error

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="space-y-3 rounded-3xl bg-telegram-secondary-bg/65 p-4">
                <SectionHeader title="Аналитика" description="Сводка тренировок, достижения и здоровье." />
                <ProgressScreenTabs />
                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar" aria-label="Период аналитики">
                    {PERIOD_OPTIONS.map((opt) => {
                        const active = opt.id === period
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    setPeriod(opt.id)
                                }}
                                className={cn(
                                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-transparent bg-telegram-bg text-telegram-hint',
                                )}
                                aria-pressed={active}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </section>

            {mainError ? (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{getErrorMessage(mainError)}</p>
            ) : null}

            {isMainLoading ? (
                <div className="space-y-2">
                    <div className="h-28 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                    <div className="h-40 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                </div>
            ) : null}

            {!isMainLoading && analyticsQuery.data && analyticsQuery.data.total_workouts === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-primary/10 via-telegram-secondary-bg/80 to-transparent p-6 text-center">
                    <Sparkles className="mx-auto h-10 w-10 text-primary" aria-hidden />
                    <h2 className="mt-3 text-lg font-semibold text-telegram-text">Первый шаг — в зале</h2>
                    <p className="mt-2 text-sm text-telegram-hint">
                        Завершите первую тренировку: здесь появятся график, любимые упражнения и серия дней.
                    </p>
                    <Button type="button" className="mt-5 w-full max-w-xs" onClick={() => navigate('/workouts')}>
                        К тренировкам
                    </Button>
                </div>
            ) : null}

            {!isMainLoading && analyticsQuery.data && analyticsQuery.data.total_workouts > 0 ? (
                <>
                    <section className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Ваш ритм</p>
                                <h2 className="mt-2 text-xl font-semibold text-telegram-text">
                                    {analyticsQuery.data.total_workouts}{' '}
                                    {analyticsQuery.data.total_workouts === 1 ? 'тренировка' : 'тренировок'}
                                </h2>
                                <p className="mt-1 text-sm text-telegram-hint">
                                    За выбранный период · серия {analyticsQuery.data.streak_days}{' '}
                                    {analyticsQuery.data.streak_days === 1 ? 'день' : 'дн.'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-telegram-secondary-bg px-3 py-2 text-right">
                                <p className="text-[11px] uppercase tracking-wide text-telegram-hint">На этой неделе</p>
                                <p className="mt-1 text-2xl font-semibold leading-none text-telegram-text">
                                    {analyticsQuery.data.workouts_this_week}
                                </p>
                                <p className="mt-1 text-xs text-telegram-hint">тренировок</p>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-2">
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <Timer className="h-4 w-4 text-primary" />
                            <p className="mt-2 text-xs text-telegram-hint">Время за период</p>
                            <p className="mt-1 text-lg font-semibold text-telegram-text">
                                {formatMinutes(analyticsQuery.data.total_duration_minutes)}
                            </p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <Activity className="h-4 w-4 text-primary" />
                            <p className="mt-2 text-xs text-telegram-hint">Средняя длительность</p>
                            <p className="mt-1 text-lg font-semibold text-telegram-text">
                                {analyticsQuery.data.avg_duration > 0
                                    ? `${analyticsQuery.data.avg_duration} мин`
                                    : '—'}
                            </p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            <p className="mt-2 text-xs text-telegram-hint">В этом месяце</p>
                            <p className="mt-1 text-lg font-semibold text-telegram-text">
                                {analyticsQuery.data.workouts_this_month}
                            </p>
                        </article>
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <Flame className="h-4 w-4 text-amber-500" />
                            <p className="mt-2 text-xs text-telegram-hint">Любимое упражнение</p>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-telegram-text">
                                {analyticsQuery.data.favorite_exercise ?? '—'}
                            </p>
                        </article>
                    </section>

                    <section className="rounded-3xl bg-telegram-secondary-bg/65 p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold text-telegram-text">Интенсивность</h2>
                        </div>
                        {showIntensityRpeHint ? (
                            <p className="mb-3 rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Оценивайте усилие после подходов для точной аналитики
                            </p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2">
                            <article className="rounded-2xl bg-telegram-bg p-3">
                                <p className="text-[11px] text-telegram-hint">Средний RPE</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {analyticsQuery.data.avg_rpe_per_workout != null
                                        ? analyticsQuery.data.avg_rpe_per_workout.toFixed(1)
                                        : '—'}
                                </p>
                                {analyticsQuery.data.avg_rpe_trend ? (
                                    <p className="mt-1 text-[10px] text-telegram-hint">
                                        {formatRpeTrendLabel(analyticsQuery.data.avg_rpe_trend)}
                                    </p>
                                ) : null}
                            </article>
                            <article className="rounded-2xl bg-telegram-bg p-3">
                                <p className="text-[11px] text-telegram-hint">Средний отдых</p>
                                <p className="mt-1 text-sm font-semibold leading-snug text-telegram-text">
                                    {formatAvgRestSeconds(analyticsQuery.data.avg_rest_time_seconds ?? null)}
                                </p>
                            </article>
                            <article className="rounded-2xl bg-telegram-bg p-3">
                                <p className="text-[11px] text-telegram-hint">Время под нагрузкой</p>
                                <p className="mt-1 text-sm font-semibold text-telegram-text">
                                    {analyticsQuery.data.total_time_under_tension_seconds != null
                                        ? `${Math.round(analyticsQuery.data.total_time_under_tension_seconds)} сек`
                                        : '—'}
                                </p>
                            </article>
                            <article className="rounded-2xl bg-telegram-bg p-3">
                                <p className="text-[11px] text-telegram-hint">Индекс интенсивности</p>
                                <p className="mt-1 text-lg font-semibold text-telegram-text">
                                    {analyticsQuery.data.intensity_score != null
                                        ? analyticsQuery.data.intensity_score.toFixed(2)
                                        : '—'}
                                </p>
                            </article>
                        </div>
                        {showIntensityScoreChart ? (
                            <div className="mt-4">
                                <ProgressTrendBars
                                    title="Индекс интенсивности по неделям"
                                    subtitle="По неделям с понедельника; нужны данные хотя бы за две недели."
                                    items={intensityChartItems}
                                    valueFormatter={(v) => v.toFixed(2)}
                                    emptyMessage="Недостаточно данных для графика."
                                />
                            </div>
                        ) : null}
                    </section>

                    <ProgressTrendBars
                        title={period === 'week' ? 'Тренировки по дням' : 'Тренировки по неделям'}
                        subtitle={
                            period === 'week'
                                ? 'Последние 7 дней в выбранном окне'
                                : 'Сумма тренировок за каждую неделю (понедельник — начало недели)'
                        }
                        items={chartItems}
                        valueFormatter={(v) => `${v}`}
                        emptyMessage="Нет данных для графика."
                    />
                </>
            ) : null}

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-telegram-text">Достижения</h2>
                </div>
                {achievementsQuery.isPending ? (
                    <div className="h-16 animate-pulse rounded-xl bg-telegram-bg" />
                ) : achievementsQuery.error ? (
                    <p className="text-xs text-danger">{getErrorMessage(achievementsQuery.error)}</p>
                ) : earnedAchievements.length === 0 ? (
                    <SectionEmptyState
                        icon={Trophy}
                        title="Пока без достижений"
                        description="Продолжайте тренироваться — награды появятся автоматически."
                    />
                ) : (
                    <ul className="space-y-2">
                        {earnedAchievements.slice(0, 8).map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-2 rounded-xl bg-telegram-bg px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium text-telegram-text">{row.achievement.name}</p>
                                    <p className="mt-0.5 text-xs text-telegram-hint">{row.achievement.description}</p>
                                </div>
                                <p className="shrink-0 text-xs text-telegram-hint">
                                    {format(parseISO(row.earned_at), 'd MMM yyyy', { locale: ru })}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-telegram-text">Челленджи</h2>
                </div>
                {challengesQuery.isPending ? (
                    <div className="h-16 animate-pulse rounded-xl bg-telegram-bg" />
                ) : challengesQuery.error ? (
                    <p className="text-xs text-danger">{getErrorMessage(challengesQuery.error)}</p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-telegram-hint">Активные</p>
                            {(challengesQuery.data?.active.length ?? 0) === 0 ? (
                                <p className="mt-2 text-xs text-telegram-hint">Нет активных челленджей.</p>
                            ) : (
                                <ul className="mt-2 space-y-2">
                                    {challengesQuery.data!.active.map((c) => (
                                        <li key={c.id} className="rounded-xl bg-telegram-bg px-3 py-2 text-sm text-telegram-text">
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-telegram-hint">Завершённые</p>
                            {(challengesQuery.data?.completed.length ?? 0) === 0 ? (
                                <p className="mt-2 text-xs text-telegram-hint">Завершённых челленджей пока нет.</p>
                            ) : (
                                <ul className="mt-2 space-y-2">
                                    {challengesQuery.data!.completed.map((c) => (
                                        <li
                                            key={c.id}
                                            className="rounded-xl bg-telegram-bg/80 px-3 py-2 text-sm text-telegram-hint line-through decoration-telegram-hint/60"
                                        >
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-rose-500" />
                    <h2 className="text-sm font-semibold text-telegram-text">Метрики здоровья</h2>
                </div>
                {healthQuery.isPending ? (
                    <div className="h-16 animate-pulse rounded-xl bg-telegram-bg" />
                ) : healthQuery.error ? (
                    <p className="text-xs text-danger">{getErrorMessage(healthQuery.error)}</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <article className="rounded-xl bg-telegram-bg p-3">
                            <p className="text-xs text-telegram-hint">Сон (ср.)</p>
                            <p className="mt-1 text-sm font-semibold text-telegram-text">
                                {healthQuery.data?.wellness?.avg_sleep_score_30d != null
                                    ? `${Math.round(healthQuery.data.wellness.avg_sleep_score_30d)} баллов`
                                    : '—'}
                            </p>
                        </article>
                        <article className="rounded-xl bg-telegram-bg p-3">
                            <p className="text-xs text-telegram-hint">Энергия (ср.)</p>
                            <p className="mt-1 text-sm font-semibold text-telegram-text">
                                {healthQuery.data?.wellness?.avg_energy_score_30d != null
                                    ? `${Math.round(healthQuery.data.wellness.avg_energy_score_30d)} баллов`
                                    : '—'}
                            </p>
                        </article>
                    </div>
                )}
            </section>
        </div>
    )
}
