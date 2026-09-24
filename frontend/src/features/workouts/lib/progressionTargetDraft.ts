/**
 * SPEC-006 §58: the progression-target editor's pure part.
 *
 * Kept out of the page component so the "only send what the user changed" rule
 * stays readable (and testable) without a DOM.
 */
import type {
    ProgressionPolicy,
    ProgressionRecommendation,
    ProgressionTargetUpdateRequest,
} from '@features/workouts/types/workouts'

/** Russian labels for the policy types, shared by the editor and the bulk toolbar. */
export const PROGRESSION_POLICY_LABELS: Record<ProgressionPolicy, string> = {
    MANUAL: 'Ручная прогрессия',
    LINEAR: 'Линейная прогрессия',
    DOUBLE_PROGRESSION: 'Двойная прогрессия',
    RPE_BASED: 'Прогрессия по RPE',
    RIR_BASED: 'Прогрессия по RIR',
    PERCENT_1RM: 'Процент от 1ПМ',
    TIME_PROGRESSION: 'Прогрессия по времени',
}

/** What the inline editor holds while the user types. */
export interface TargetDraft {
    value: string
    policy: ProgressionPolicy
    repsMin: string
    repsMax: string
}

/**
 * The policy that governs the target right now.
 *
 * ``effective_policy`` is what the scope is configured with today; ``policy`` is
 * the policy the target was produced by, which stays history after an edit.
 */
export function effectivePolicy(item: ProgressionRecommendation): ProgressionPolicy {
    return item.effective_policy ?? item.policy
}

export function isTimed(item: ProgressionRecommendation): boolean {
    return effectivePolicy(item) === 'TIME_PROGRESSION'
}

/** The unit a target is shown in right now (kg, or seconds when timed). */
export function targetUnit(item: ProgressionRecommendation): 'kg' | 'seconds' {
    return isTimed(item) ? 'seconds' : 'kg'
}

/** «82.5 кг» / «60 сек» — one formatted value, unit included. */
export function formatTargetValue(
    value: number | null | undefined,
    unit: 'kg' | 'seconds',
): string {
    if (value == null || !Number.isFinite(Number(value))) return '—'
    const numeric = Number(value)
    const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
    return unit === 'seconds' ? `${formatted} сек` : `${formatted} кг`
}

/** «Жим лёжа · 82.5 кг» — how one target is named in a summary line. */
export function targetLabel(item: ProgressionRecommendation): string {
    const name = item.exercise_name || `Упражнение #${item.exercise_id ?? '—'}`
    const value = item.actual_selected_value ?? item.recommended_value
    return value == null ? name : `${name} · ${formatTargetValue(value, targetUnit(item))}`
}

/** Current target and policy as editable strings. */
export function draftFor(item: ProgressionRecommendation): TargetDraft {
    const value = item.actual_selected_value ?? item.recommended_value
    return {
        value: value == null ? '' : String(value),
        policy: effectivePolicy(item),
        repsMin: item.reps_min == null ? '' : String(item.reps_min),
        repsMax: item.reps_max == null ? '' : String(item.reps_max),
    }
}

/**
 * Turn the editor's draft into a PATCH body.
 *
 * Only the fields the user actually changed are sent, so an edit never resets a
 * policy parameter nobody touched. Returns the reason instead of a payload when
 * the draft cannot be stored, and an empty payload when nothing changed.
 */
export function parseTargetDraft(
    item: ProgressionRecommendation,
    draft: TargetDraft,
): { payload: ProgressionTargetUpdateRequest; error: string | null } {
    const currentValue = item.actual_selected_value ?? item.recommended_value ?? null
    const rawValue = draft.value.trim().replace(',', '.')
    const value = rawValue === '' ? Number.NaN : Number(rawValue)
    if (!Number.isFinite(value) || value <= 0) {
        return { payload: {}, error: 'Введите значение больше 0' }
    }

    const payload: ProgressionTargetUpdateRequest = {}
    if (currentValue == null || Math.abs(value - Number(currentValue)) > 1e-9) {
        payload.value = value
    }
    if (draft.policy !== effectivePolicy(item)) {
        payload.type = draft.policy
    }

    const rawMin = draft.repsMin.trim()
    const rawMax = draft.repsMax.trim()
    const currentMin = item.reps_min ?? null
    const currentMax = item.reps_max ?? null
    const rangeUntouched =
        rawMin === '' && rawMax === '' && currentMin == null && currentMax == null
    if (!rangeUntouched) {
        const repsMin = Number(rawMin)
        const repsMax = Number(rawMax)
        const integers =
            rawMin !== '' &&
            rawMax !== '' &&
            Number.isInteger(repsMin) &&
            Number.isInteger(repsMax) &&
            repsMin >= 0 &&
            repsMax >= 0
        if (!integers) {
            return { payload: {}, error: 'Укажите диапазон повторов целыми числами' }
        }
        if (repsMin > repsMax) {
            return { payload: {}, error: 'Минимум повторов не может быть больше максимума' }
        }
        if (repsMin !== currentMin || repsMax !== currentMax) {
            payload.reps_min = repsMin
            payload.reps_max = repsMax
        }
    }

    return { payload, error: null }
}
