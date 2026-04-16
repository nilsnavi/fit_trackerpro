import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Info, Scale } from 'lucide-react'
import { analyticsApi } from '@shared/api/domains/analyticsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { cn } from '@shared/lib/cn'
import { Button } from '@shared/ui/Button'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MuscleImbalanceSignals {
    back_vs_chest_ratio_28d?: number | null
    posterior_vs_anterior_ratio_28d?: number | null
    pull_vs_push_ratio_28d?: number | null
    hamstrings_vs_quads_ratio_28d?: number | null
    core_share_ratio_28d?: number | null
    weak_back_signal?: boolean | null
    pull_underload_signal?: boolean | null
    posterior_leg_underload_signal?: boolean | null
    avg_rpe_7d?: number | null
    avg_rir_7d?: number | null
    back_volume_7d?: number | null
    chest_volume_7d?: number | null
    days_since_back_session?: number | null
    days_since_chest_session?: number | null
}

interface MuscleImbalanceResponse {
    available: boolean
    signals?: MuscleImbalanceSignals | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRatio(val: number | null | undefined): string {
    if (val == null || !Number.isFinite(val)) return '—'
    return val.toFixed(2)
}

function ratioStatus(val: number | null | undefined, ideal = 1.0, tolerance = 0.15): 'ok' | 'warn' | 'unknown' {
    if (val == null || !Number.isFinite(val)) return 'unknown'
    return Math.abs(val - ideal) <= tolerance ? 'ok' : 'warn'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertRow({ label, active }: { label: string; active: boolean | null | undefined }) {
    if (active == null) return null
    return (
        <div
            className={cn(
                'flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm',
                active
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-telegram-bg/70 text-telegram-hint',
            )}
        >
            {active ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <span>{label}</span>
        </div>
    )
}

function RatioRow({
    label,
    value,
    ideal,
    hint,
}: {
    label: string
    value: number | null | undefined
    ideal?: number
    hint?: string
}) {
    const status = ratioStatus(value, ideal)
    return (
        <div className="flex items-center justify-between gap-2 py-1.5">
            <div className="min-w-0">
                <p className="truncate text-sm text-telegram-text">{label}</p>
                {hint ? <p className="text-[11px] text-telegram-hint">{hint}</p> : null}
            </div>
            <span
                className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                    status === 'ok' && 'bg-emerald-500/15 text-emerald-400',
                    status === 'warn' && 'bg-amber-500/15 text-amber-400',
                    status === 'unknown' && 'bg-telegram-secondary-bg text-telegram-hint',
                )}
            >
                {formatRatio(value)}
            </span>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MuscleSignalsCard() {
    const query = useQuery<MuscleImbalanceResponse>({
        queryKey: queryKeys.analytics.muscleSignals,
        queryFn: () => analyticsApi.getMuscleSignals() as Promise<MuscleImbalanceResponse>,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const signals = query.data?.signals
    const available = query.data?.available ?? false

    const hasAnySignal =
        signals?.weak_back_signal != null ||
        signals?.pull_underload_signal != null ||
        signals?.posterior_leg_underload_signal != null

    const activeAlerts = [
        signals?.weak_back_signal,
        signals?.pull_underload_signal,
        signals?.posterior_leg_underload_signal,
    ].filter(Boolean).length

    return (
        <section className="rounded-2xl bg-telegram-secondary-bg p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-telegram-text">Мышечный баланс</h2>
                </div>
                {!query.isPending && available && activeAlerts > 0 ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                        {activeAlerts} сигнал{activeAlerts > 1 ? 'а' : ''}
                    </span>
                ) : null}
            </div>

            {query.isPending ? (
                <div className="space-y-2">
                    <div className="h-10 animate-pulse rounded-xl bg-telegram-bg" />
                    <div className="h-10 animate-pulse rounded-xl bg-telegram-bg" />
                    <div className="h-10 animate-pulse rounded-xl bg-telegram-bg" />
                </div>
            ) : query.error ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
                    <p className="text-danger text-xs">Не удалось загрузить данные о балансе мышц</p>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => void query.refetch()}
                    >
                        Повторить
                    </Button>
                </div>
            ) : !available || !signals ? (
                <SectionEmptyState
                    icon={Info}
                    title="Недостаточно данных"
                    description="Завершите несколько тренировок с разными группами мышц за последние 28 дней."
                />
            ) : (
                <div className="space-y-4">
                    {/* Alert signals */}
                    {hasAnySignal ? (
                        <div className="space-y-1.5">
                            <AlertRow
                                label="Спина слабее груди — добавьте тяговые упражнения"
                                active={signals.weak_back_signal}
                            />
                            <AlertRow
                                label="Тяговые движения в дефиците (pull < push)"
                                active={signals.pull_underload_signal}
                            />
                            <AlertRow
                                label="Задняя цепь ног недогружена (подколенные < квадрицепсы)"
                                active={signals.posterior_leg_underload_signal}
                            />
                        </div>
                    ) : null}

                    {/* Ratio metrics */}
                    <div className="divide-y divide-border/40">
                        <RatioRow
                            label="Спина / Грудь"
                            value={signals.back_vs_chest_ratio_28d}
                            ideal={1.0}
                            hint="Оптимально ≈ 1.0 (объём за 28 дней)"
                        />
                        <RatioRow
                            label="Тяга / Жим"
                            value={signals.pull_vs_push_ratio_28d}
                            ideal={1.0}
                            hint="Рекомендуется ≥ 1.0"
                        />
                        <RatioRow
                            label="Задняя цепь / Квадрицепсы"
                            value={signals.hamstrings_vs_quads_ratio_28d}
                            ideal={0.75}
                            hint="Норма ≈ 0.6–0.9"
                        />
                        <RatioRow
                            label="Передняя / Задняя"
                            value={signals.posterior_vs_anterior_ratio_28d}
                            ideal={1.0}
                            hint="Баланс толкательных и тяговых мышц"
                        />
                        {signals.core_share_ratio_28d != null ? (
                            <RatioRow
                                label="Доля кора от общего объёма"
                                value={signals.core_share_ratio_28d}
                                ideal={0.1}
                                hint="Рекомендуется ≥ 8–12 %"
                            />
                        ) : null}
                    </div>

                    {/* RPE hint */}
                    {signals.avg_rpe_7d != null ? (
                        <p className="text-[11px] text-telegram-hint">
                            Средний RPE за 7 дней: {signals.avg_rpe_7d.toFixed(1)}
                            {signals.avg_rir_7d != null
                                ? ` · RIR: ${signals.avg_rir_7d.toFixed(1)}`
                                : ''}
                        </p>
                    ) : null}
                </div>
            )}
        </section>
    )
}
