import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@shared/api/domains/analyticsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { ANALYTICS_STALE_MS } from './constants'

// ─── Backend Types (current API response) ─────────────────────────────────────

export interface MuscleImbalanceSignalsDetail {
    user_id: number
    back_volume_7d?: number | null
    chest_volume_7d?: number | null
    back_volume_28d?: number | null
    chest_volume_28d?: number | null
    shoulders_volume_28d?: number | null
    triceps_volume_28d?: number | null
    biceps_volume_28d?: number | null
    forearms_volume_28d?: number | null
    hamstrings_volume_28d?: number | null
    quads_volume_28d?: number | null
    glutes_volume_28d?: number | null
    core_volume_28d?: number | null
    total_volume_28d?: number | null
    avg_rpe_7d?: number | null
    avg_rir_7d?: number | null
    back_vs_chest_ratio_28d?: number | null
    posterior_vs_anterior_ratio_28d?: number | null
    pull_vs_push_ratio_28d?: number | null
    hamstrings_vs_quads_ratio_28d?: number | null
    core_share_ratio_28d?: number | null
    days_since_back_session?: number | null
    days_since_chest_session?: number | null
    weak_back_signal?: boolean | null
    pull_underload_signal?: boolean | null
    posterior_leg_underload_signal?: boolean | null
}

export interface MuscleImbalanceSignalsResponse {
    available: boolean
    signals?: MuscleImbalanceSignalsDetail | null
}

// ─── Frontend Types (transformed for UI) ──────────────────────────────────────

export type MuscleSignalSeverity = 'low' | 'medium' | 'high'

export interface MuscleSignal {
    muscle_group: string
    paired_group: string
    ratio: number
    severity: MuscleSignalSeverity
    recommendation: string
}

export interface MuscleSignalsUI {
    signals: MuscleSignal[]
    avgRpe7d: number | null
    avgRir7d: number | null
}

// ─── Mapper ────────────────────────────────────────────────────────────────────

function determineSeverity(ratio: number, ideal: number): MuscleSignalSeverity {
    const deviation = Math.abs(ratio - ideal)
    if (deviation <= 0.15) return 'low'
    if (deviation <= 0.35) return 'medium'
    return 'high'
}

function mapToUISignals(data: MuscleImbalanceSignalsDetail): MuscleSignal[] {
    const signals: MuscleSignal[] = []

    // Back vs Chest
    if (data.back_vs_chest_ratio_28d != null && Number.isFinite(data.back_vs_chest_ratio_28d)) {
        const ratio = data.back_vs_chest_ratio_28d
        signals.push({
            muscle_group: 'back',
            paired_group: 'chest',
            ratio,
            severity: determineSeverity(ratio, 1.0),
            recommendation:
                ratio < 0.85
                    ? 'Добавьте больше тяговых упражнений для баланса со спиной'
                    : ratio > 1.15
                        ? 'Добавьте больше жимовых движений для баланса груди'
                        : 'Баланс спины и груди в норме',
        })
    }

    // Pull vs Push
    if (data.pull_vs_push_ratio_28d != null && Number.isFinite(data.pull_vs_push_ratio_28d)) {
        const ratio = data.pull_vs_push_ratio_28d
        signals.push({
            muscle_group: 'lats', // тяговые
            paired_group: 'chest', // жимовые
            ratio,
            severity: determineSeverity(ratio, 1.0),
            recommendation:
                ratio < 0.85
                    ? 'Увеличьте объём тяговых движений (вертикальные и горизонтальные тяги)'
                    : ratio > 1.15
                        ? 'Добавьте больше жимовых упражнений'
                        : 'Баланс тяги/жима оптимален',
        })
    }

    // Hamstrings vs Quads
    if (data.hamstrings_vs_quads_ratio_28d != null && Number.isFinite(data.hamstrings_vs_quads_ratio_28d)) {
        const ratio = data.hamstrings_vs_quads_ratio_28d
        signals.push({
            muscle_group: 'hamstrings',
            paired_group: 'quads',
            ratio,
            severity: determineSeverity(ratio, 0.75),
            recommendation:
                ratio < 0.5
                    ? 'Существенный дисбаланс: добавьте упражнения на заднюю поверхность бедра'
                    : ratio < 0.6
                        ? 'Умеренный дисбаланс: увеличьте объём сгибаний и румынской тяги'
                        : 'Баланс мышц ног в норме',
        })
    }

    // Posterior vs Anterior (if available)
    if (data.posterior_vs_anterior_ratio_28d != null && Number.isFinite(data.posterior_vs_anterior_ratio_28d)) {
        const ratio = data.posterior_vs_anterior_ratio_28d
        signals.push({
            muscle_group: 'back_chain',
            paired_group: 'front_chain',
            ratio,
            severity: determineSeverity(ratio, 1.0),
            recommendation:
                ratio < 0.85
                    ? 'Задняя цепь недогружена: добавьте становую тягу, гиперэкстензии'
                    : 'Баланс передней и задней цепи в норме',
        })
    }

    // Core share
    if (data.core_share_ratio_28d != null && Number.isFinite(data.core_share_ratio_28d)) {
        const ratio = data.core_share_ratio_28d
        const severity: MuscleSignalSeverity = ratio < 0.08 ? 'high' : ratio < 0.1 ? 'medium' : 'low'
        signals.push({
            muscle_group: 'core',
            paired_group: 'total',
            ratio,
            severity,
            recommendation:
                ratio < 0.08
                    ? 'Доля кора слишком мала: добавьте планки и скручивания'
                    : 'Доля кора в тренировках оптимальна',
        })
    }

    return signals
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMuscleSignals() {
    const query = useQuery<MuscleImbalanceSignalsResponse>({
        queryKey: queryKeys.analytics.muscleSignals,
        queryFn: () => analyticsApi.getMuscleSignals() as Promise<MuscleImbalanceSignalsResponse>,
        staleTime: ANALYTICS_STALE_MS,
    })

    // Transform backend response to UI-friendly format
    const uiData: MuscleSignalsUI | null = query.data?.available && query.data.signals
        ? {
            signals: mapToUISignals(query.data.signals),
            avgRpe7d: query.data.signals.avg_rpe_7d ?? null,
            avgRir7d: query.data.signals.avg_rir_7d ?? null,
        }
        : null

    return {
        ...query,
        uiData,
    }
}
