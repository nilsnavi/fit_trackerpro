import { Modal } from '@shared/ui/Modal'
import type { ProgressionRecommendation as Recommendation } from '../hooks/useProgressionRecommendation'

export interface ProgressionWhySheetProps {
    recommendation: Recommendation
    previousSets?: Array<{
        set_number?: number
        reps?: number | null
        weight?: number | null
        duration?: number | null
    }>
    isOpen: boolean
    onClose: () => void
}

const POLICY_LABELS: Record<string, string> = {
    MANUAL: 'Ручная прогрессия',
    LINEAR: 'Линейная прогрессия',
    DOUBLE_PROGRESSION: 'Двойная прогрессия',
    RPE_BASED: 'Прогрессия по RPE',
    RIR_BASED: 'Прогрессия по RIR',
    PERCENT_1RM: 'Процент от 1ПМ',
    TIME_PROGRESSION: 'Прогрессия по времени',
}

function formatValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * SPEC-006 §46: "Почему?" explanation, rendered from stored fields only.
 *
 * Loaded on demand so the active-workout bundle stays inside its budget.
 */
export default function ProgressionWhySheet({
    recommendation,
    previousSets,
    isOpen,
    onClose,
}: ProgressionWhySheetProps) {
    const unit =
        recommendation.policy === 'TIME_PROGRESSION' || recommendation.recommended_duration != null
            ? 'сек'
            : 'кг'
    const repsRange =
        recommendation.reps_min != null && recommendation.reps_max != null
            ? `${recommendation.reps_min}–${recommendation.reps_max}`
            : null

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Почему ${
                formatValue(recommendation.recommended_value ?? recommendation.previous_value)
            } ${unit}?`}
            size="md"
        >
            <div data-testid="progression-why-sheet" className="space-y-4 pb-2">
                {previousSets && previousSets.length > 0 ? (
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-telegram-hint">
                            Прошлая тренировка
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm font-semibold text-telegram-text">
                            {previousSets.map((set, index) => (
                                <li key={set.set_number ?? index}>
                                    {formatValue(set.weight)} кг × {set.reps ?? '—'}
                                    {set.duration != null ? ` · ${set.duration} сек` : ''}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-telegram-hint">
                        Расчёт
                    </p>
                    <p className="mt-1 text-sm font-semibold text-telegram-text">
                        {recommendation.reason_text || '—'}
                    </p>
                </div>

                <div className="space-y-1 text-sm font-semibold text-telegram-hint">
                    <p>Политика: {POLICY_LABELS[recommendation.policy] ?? recommendation.policy}</p>
                    <p>Правило: {recommendation.reason_code}</p>
                    {recommendation.policy_version ? (
                        <p>Версия правил: {recommendation.policy_version}</p>
                    ) : null}
                    <p>
                        Шаг:{' '}
                        {recommendation.difference != null && recommendation.difference !== 0
                            ? `${recommendation.difference > 0 ? '+' : ''}${formatValue(
                                recommendation.difference,
                            )} ${unit}`
                            : 'без изменений'}
                    </p>
                    <p>
                        Следующая цель: {formatValue(recommendation.recommended_value)} {unit}
                        {repsRange ? ` × ${repsRange}` : ''}
                    </p>
                    <p>Надёжность данных: {recommendation.confidence}</p>
                </div>

                {recommendation.recovery_warning ? (
                    <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning">
                        {recommendation.recovery_warning}
                    </p>
                ) : null}
            </div>
        </Modal>
    )
}
