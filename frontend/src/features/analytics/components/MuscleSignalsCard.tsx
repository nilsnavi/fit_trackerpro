import { AlertTriangle, Scale, CheckCircle2 } from 'lucide-react'
import { useMuscleSignals, type MuscleSignal, type MuscleSignalSeverity } from '@/hooks/analytics'
import { getErrorMessage } from '@shared/errors'
import { cn } from '@shared/lib/cn'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MUSCLE_GROUP_NAMES: Record<string, string> = {
    chest: 'Грудь',
    back: 'Спина',
    shoulders: 'Плечи',
    biceps: 'Бицепс',
    triceps: 'Трицепс',
    forearms: 'Предплечья',
    quads: 'Квадрицепс',
    hamstrings: 'Бицепс бедра',
    glutes: 'Ягодицы',
    core: 'Кор',
    lats: 'Широчайшие',
    traps: 'Трапеции',
    calves: 'Икры',
}

const SEVERITY_CONFIG: Record<
    MuscleSignalSeverity,
    { color: string; bg: string; border: string; label: string }
> = {
    low: {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        label: 'Незначительно',
    },
    medium: {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        label: 'Умеренно',
    },
    high: {
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        label: 'Существенно',
    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function translateMuscleGroup(key: string): string {
    return MUSCLE_GROUP_NAMES[key] ?? key
}

function formatRatio(ratio: number): string {
    if (!Number.isFinite(ratio)) return '—'
    return ratio.toFixed(2)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ComparisonBar({ ratio, severity }: { ratio: number; severity: MuscleSignalSeverity }) {
    const config = SEVERITY_CONFIG[severity]
    // Ratio represents muscle_group / paired_group
    // We show two bars: muscle_group (left) and paired_group (right)
    // If ratio < 1, muscle_group is smaller, if ratio > 1, muscle_group is larger
    const leftPercent = Math.min(100, Math.max(0, ratio * 50))
    const rightPercent = Math.min(100, Math.max(0, (1 / Math.max(0.1, ratio)) * 50))

    return (
        <div className="flex items-center gap-1">
            {/* Left bar (muscle_group) */}
            <div className="h-2 flex-1 rounded-full bg-telegram-bg">
                <div
                    className={cn('h-full rounded-full transition-all', config.bg)}
                    style={{ width: `${leftPercent}%`, marginLeft: 'auto' }}
                />
            </div>
            {/* Center indicator */}
            <div className="h-3 w-0.5 shrink-0 rounded-full bg-telegram-hint/30" />
            {/* Right bar (paired_group) */}
            <div className="h-2 flex-1 rounded-full bg-telegram-bg">
                <div
                    className={cn('h-full rounded-full transition-all', config.bg)}
                    style={{ width: `${rightPercent}%` }}
                />
            </div>
        </div>
    )
}

function SignalCard({ signal }: { signal: MuscleSignal }) {
    const config = SEVERITY_CONFIG[signal.severity]

    return (
        <article className={cn('rounded-xl border p-3', config.bg, config.border)}>
            {/* Header with severity */}
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className={cn('text-xs font-medium', config.color)}>
                    {config.label}
                </span>
                <span className="rounded-full bg-telegram-bg/50 px-2 py-0.5 text-xs tabular-nums text-telegram-hint">
                    {formatRatio(signal.ratio)}
                </span>
            </div>

            {/* Muscle group pair */}
            <div className="mb-2">
                <p className="text-sm font-medium text-telegram-text">
                    {translateMuscleGroup(signal.muscle_group)} / {translateMuscleGroup(signal.paired_group)}
                </p>
            </div>

            {/* Comparison bar */}
            <ComparisonBar ratio={signal.ratio} severity={signal.severity} />

            {/* Recommendation */}
            <p className="mt-2 text-xs leading-relaxed text-telegram-hint">
                {signal.recommendation}
            </p>
        </article>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MuscleSignalsCard() {
    const { isPending, error, uiData, refetch } = useMuscleSignals()

    const signals = uiData?.signals ?? []
    const highSeverityCount = signals.filter((s) => s.severity === 'high').length
    const mediumSeverityCount = signals.filter((s) => s.severity === 'medium').length

    return (
        <section className="rounded-2xl bg-telegram-secondary-bg p-4">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-telegram-text">Дисбаланс мышц</h2>
                </div>
                {!isPending && signals.length > 0 && (highSeverityCount > 0 || mediumSeverityCount > 0) ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {highSeverityCount + mediumSeverityCount}
                    </span>
                ) : null}
            </div>

            {/* Loading state */}
            {isPending ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-xl bg-telegram-bg p-3">
                            <div className="mb-2 flex justify-between">
                                <div className="h-4 w-16 animate-pulse rounded bg-telegram-secondary-bg" />
                                <div className="h-4 w-10 animate-pulse rounded bg-telegram-secondary-bg" />
                            </div>
                            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-telegram-secondary-bg" />
                            <div className="h-2 w-full animate-pulse rounded-full bg-telegram-secondary-bg" />
                            <div className="mt-2 h-3 w-full animate-pulse rounded bg-telegram-secondary-bg" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                    <p className="text-xs text-danger">
                        Не удалось загрузить данные: {getErrorMessage(error)}
                    </p>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => void refetch()}
                    >
                        Повторить
                    </Button>
                </div>
            ) : signals.length === 0 ? (
                <EmptyState
                    icon={CheckCircle2}
                    title="Баланс в норме"
                    description="Нет выраженных дисбалансов между парными группами мышц."
                    tone="telegram"
                    compact
                />
            ) : (
                <div className="space-y-2">
                    {signals.map((signal, idx) => (
                        <SignalCard key={`${signal.muscle_group}-${signal.paired_group}-${idx}`} signal={signal} />
                    ))}
                </div>
            )}
        </section>
    )
}
