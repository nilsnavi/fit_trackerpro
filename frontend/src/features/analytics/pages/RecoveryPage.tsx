import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { HeartPulse, Loader2, Moon, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { ProgressPeriodFilter } from '@features/analytics/components/ProgressPeriodFilter'
import { ProgressScreenTabs } from '@features/analytics/components/ProgressScreenTabs'
import {
    getAnalyticsMuscleLoad,
    getAnalyticsRecoveryState,
    getAnalyticsTrainingLoadDaily,
    type ApiMuscleLoadEntry,
    type ApiRecoveryStateResponse,
    type ApiTrainingLoadDailyEntry,
} from '@features/analytics/api/analyticsDomain'
import { useRecalculateRecoveryMutation } from '@features/analytics/hooks/useRecoveryMutations'
import { useToastStore } from '@shared/stores/toastStore'
import { ProgressTrendBars } from '@features/analytics/components/ProgressTrendBars'
import {
    getAnalyticsDateRange,
    PROGRESS_PERIODS_SHORT,
    type ProgressPeriod,
} from '@features/analytics/lib/progressDateRange'

function summarizeLoad(load: ApiTrainingLoadDailyEntry[]) {
    if (load.length === 0) {
        return { avgVolume: 0, avgFatigue: 0, avgRpe: 0 }
    }

    const avgVolume = Math.round(load.reduce((acc, item) => acc + item.volume, 0) / load.length)
    const avgFatigue = Math.round(load.reduce((acc, item) => acc + item.fatigueScore, 0) / load.length)
    const validRpe = load.map((item) => item.avgRpe).filter((value): value is number => typeof value === 'number')
    const avgRpe = validRpe.length > 0 ? Number((validRpe.reduce((acc, item) => acc + item, 0) / validRpe.length).toFixed(1)) : 0

    return { avgVolume, avgFatigue, avgRpe }
}

function topMuscles(rows: ApiMuscleLoadEntry[]) {
    const scoreByMuscle = new Map<string, number>()

    rows.forEach((row) => {
        scoreByMuscle.set(row.muscleGroup, (scoreByMuscle.get(row.muscleGroup) ?? 0) + row.loadScore)
    })

    return Array.from(scoreByMuscle.entries())
        .map(([muscle, total]) => ({ muscle, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
}

export default function RecoveryPage() {
    const [period, setPeriod] = useState<ProgressPeriod>('30d')
    const range = useMemo(() => getAnalyticsDateRange(period), [period])
    const dateFrom = range.date_from ?? null
    const dateTo = range.date_to ?? null
    const pushToast = useToastStore((s) => s.push)

    const recoveryQuery = useQuery<ApiRecoveryStateResponse>({
        queryKey: queryKeys.analytics.recoveryState,
        queryFn: () => getAnalyticsRecoveryState(),
        staleTime: 30_000,
    })

    const recalculateMutation = useRecalculateRecoveryMutation()

    const handleRecalculate = () => {
        recalculateMutation.mutate(
            {
                date_from: dateFrom ?? undefined,
                date_to: dateTo ?? undefined,
            },
            {
                onSuccess: () => {
                    pushToast({ kind: 'success', message: 'Состояние восстановления пересчитано' })
                },
                onError: (err) => {
                    pushToast({ kind: 'error', message: `Ошибка пересчёта: ${getErrorMessage(err)}` })
                },
            }
        )
    }

    const dailyLoadQuery = useQuery<ApiTrainingLoadDailyEntry[]>({
        queryKey: queryKeys.analytics.trainingLoadDaily(dateFrom, dateTo),
        queryFn: () => getAnalyticsTrainingLoadDaily({ ...range, period }),
        staleTime: 60_000,
    })

    const muscleLoadQuery = useQuery<ApiMuscleLoadEntry[]>({
        queryKey: queryKeys.analytics.muscleLoad(dateFrom, dateTo),
        queryFn: () => getAnalyticsMuscleLoad({ ...range, period }),
        staleTime: 60_000,
    })

    const isLoading = recoveryQuery.isPending || dailyLoadQuery.isPending || muscleLoadQuery.isPending
    const error = recoveryQuery.error ?? dailyLoadQuery.error ?? muscleLoadQuery.error

    const dailyLoad = useMemo(() => dailyLoadQuery.data ?? [], [dailyLoadQuery.data])
    const muscleLoad = useMemo(() => muscleLoadQuery.data ?? [], [muscleLoadQuery.data])
    const readiness = recoveryQuery.data?.readinessScore ?? 0
    const fatigue = recoveryQuery.data?.fatigueLevel ?? 0

    const summary = useMemo(() => summarizeLoad(dailyLoad), [dailyLoad])
    const topLoadedMuscles = useMemo(() => topMuscles(muscleLoad), [muscleLoad])

    const readinessStatus = readiness >= 75 ? 'Высокая' : readiness >= 50 ? 'Средняя' : 'Низкая'
    const fatigueStatus = fatigue >= 75 ? 'Высокая' : fatigue >= 50 ? 'Средняя' : 'Низкая'

    const noData = !isLoading && dailyLoad.length === 0 && muscleLoad.length === 0
    const fatigueItems = dailyLoad
        .slice(-7)
        .map((item) => ({ label: format(new Date(item.date), 'dd.MM'), value: item.fatigueScore }))

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="space-y-3 rounded-3xl bg-telegram-secondary-bg/65 p-4">
                <SectionHeader
                    title="Восстановление"
                    description="Готовность к следующей тренировке, утомление и мышечная нагрузка."
                />
                <ProgressScreenTabs />
                <ProgressPeriodFilter value={period} options={PROGRESS_PERIODS_SHORT} onChange={setPeriod} />
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
                        icon={HeartPulse}
                        title="Недостаточно данных о восстановлении"
                        description="Выполните несколько тренировок, чтобы появилась история нагрузки и состояния."
                    />
                </div>
            ) : null}

            {!isLoading && !noData ? (
                <>
                    <section className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={handleRecalculate}
                            disabled={recalculateMutation.isPending || recoveryQuery.isFetching}
                            className="flex items-center gap-1.5 rounded-lg bg-telegram-secondary-bg px-3 py-1.5 text-sm font-medium text-telegram-text transition-colors hover:bg-telegram-secondary-bg/80 disabled:opacity-50"
                        >
                            {recalculateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            <span>{recalculateMutation.isPending ? 'Пересчёт...' : 'Обновить'}</span>
                        </button>
                    </section>

                    <section className="grid grid-cols-2 gap-2">
                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-telegram-hint">Готовность</p>
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-telegram-text">{readiness}</p>
                            <p className="text-xs text-telegram-hint">{readinessStatus}</p>
                        </article>

                        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-telegram-hint">Утомление</p>
                                <Moon className="h-4 w-4 text-indigo-500" />
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-telegram-text">{fatigue}</p>
                            <p className="text-xs text-telegram-hint">{fatigueStatus}</p>
                        </article>
                    </section>

                    <section className="space-y-3">
                        <div className="rounded-2xl bg-telegram-secondary-bg p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <h2 className="text-sm font-semibold text-telegram-text">Динамика нагрузки</h2>
                            </div>
                            <ProgressTrendBars
                                title="Утомление за последние сессии"
                                subtitle="Оценка нагрузки по дням"
                                items={fatigueItems}
                                emptyMessage="Нет данных для тренда утомления."
                            />

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <article className="rounded-xl bg-telegram-bg p-3">
                                    <p className="text-xs text-telegram-hint">Ср. объём</p>
                                    <p className="mt-1 text-base font-semibold text-telegram-text">{summary.avgVolume}</p>
                                </article>
                                <article className="rounded-xl bg-telegram-bg p-3">
                                    <p className="text-xs text-telegram-hint">Ср. утомл.</p>
                                    <p className="mt-1 text-base font-semibold text-telegram-text">{summary.avgFatigue}</p>
                                </article>
                                <article className="rounded-xl bg-telegram-bg p-3">
                                    <p className="text-xs text-telegram-hint">Ср. RPE</p>
                                    <p className="mt-1 text-base font-semibold text-telegram-text">{summary.avgRpe}</p>
                                </article>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                        <h2 className="text-sm font-semibold text-telegram-text">Мышечные зоны под нагрузкой</h2>
                        {topLoadedMuscles.length === 0 ? (
                            <p className="mt-3 rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                                Нагрузки по мышечным группам пока не зафиксированы.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {topLoadedMuscles.map((item) => (
                                    <article key={item.muscle} className="rounded-xl bg-telegram-bg p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-telegram-text">{item.muscle}</p>
                                            <p className="text-sm font-semibold text-telegram-text">{item.total}</p>
                                        </div>
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
