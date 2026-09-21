/**
 * SPEC-006 §58: the bulk toolbar's pure part.
 *
 * A bulk action is about the plan, not about today's numbers: it either stops
 * the automatic prefill or writes one policy / rep range into every selected
 * target's own scope. Keeping the parsing and the selection math out of the page
 * keeps the "only apply what the user actually chose" rule testable without a
 * DOM.
 */
import {
    formatTargetValue,
    targetLabel,
} from '@features/workouts/lib/progressionTargetDraft'
import type {
    ProgressionBulkSkipReason,
    ProgressionBulkSkipped,
    ProgressionPolicy,
    ProgressionRecommendation,
    ProgressionTargetBulkUpdateRequest,
} from '@features/workouts/types/workouts'

/** What the bulk toolbar holds while the user types. */
export interface BulkDraft {
    /** Empty string means "leave the policy alone". */
    policy: ProgressionPolicy | ''
    repsMin: string
    repsMax: string
}

export const EMPTY_BULK_DRAFT: BulkDraft = { policy: '', repsMin: '', repsMax: '' }

/** The editable part of a bulk request — the ids are the selection. */
export type BulkDraftPayload = Omit<ProgressionTargetBulkUpdateRequest, 'recommendation_ids'>

/**
 * Turn the toolbar's draft into a bulk request body.
 *
 * Omitted choices stay untouched: an empty policy field never resets a scope's
 * policy, and an empty rep range never clears one. The range is all-or-nothing
 * (both bounds or neither) because a one-sided range would be resolved against
 * each scope's own inherited bound — a per-target surprise, not a plan.
 */
export function parseBulkDraft(draft: BulkDraft): {
    payload: BulkDraftPayload
    error: string | null
} {
    const payload: BulkDraftPayload = {}
    if (draft.policy !== '') {
        payload.type = draft.policy
    }

    const rawMin = draft.repsMin.trim()
    const rawMax = draft.repsMax.trim()
    if (rawMin !== '' || rawMax !== '') {
        if (rawMin === '' || rawMax === '') {
            return { payload: {}, error: 'Укажите оба значения диапазона повторов' }
        }
        const repsMin = Number(rawMin)
        const repsMax = Number(rawMax)
        if (
            !Number.isInteger(repsMin) ||
            !Number.isInteger(repsMax) ||
            repsMin < 0 ||
            repsMax < 0
        ) {
            return { payload: {}, error: 'Укажите диапазон повторов целыми числами' }
        }
        if (repsMin > repsMax) {
            return { payload: {}, error: 'Минимум повторов не может быть больше максимума' }
        }
        payload.reps_min = repsMin
        payload.reps_max = repsMax
    }

    if (payload.type == null && payload.reps_min == null) {
        return {
            payload: {},
            error: 'Выберите политику или укажите диапазон повторов',
        }
    }
    return { payload, error: null }
}

/** Ids of the rows a bulk action can address (a preview has no id). */
export function selectableIds(items: ProgressionRecommendation[]): number[] {
    return items
        .map((item) => item.id)
        .filter((id): id is number => typeof id === 'number')
}

/** Add or remove one target from the selection, preserving the order. */
export function toggleSelection(selected: number[], id: number): number[] {
    return selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id]
}

/** Russian wording for the reasons a bulk action reports for a skipped target. */
export const BULK_SKIP_REASON_LABELS: Record<ProgressionBulkSkipReason, string> = {
    already_disabled: 'Автоподстановка уже была выключена',
    not_found: 'Цель не найдена: удалена, чужая или уже не актуальна',
}

/** One skipped target as the screen shows it: what it is and why it stayed. */
export interface BulkSkipView {
    recommendationId: number
    title: string
    reason: string
}

/**
 * Turn the backend's skip report into the rows the screen shows.
 *
 * A skipped target that still exists arrives named, with its value and unit, so
 * the notice reads like the list itself. For an id that is no longer a target
 * the backend can only send the number — it then falls back to the row the user
 * picked it from, which is where such an id came from in the first place.
 */
export function describeBulkSkips(
    skipped: ProgressionBulkSkipped[],
    selected: ProgressionRecommendation[] = [],
): BulkSkipView[] {
    const chosen = new Map<number, string>()
    for (const item of selected) {
        if (item.id != null) chosen.set(item.id, targetLabel(item))
    }
    return skipped.map((entry) => ({
        recommendationId: entry.recommendation_id,
        title:
            skippedTitle(entry) ??
            chosen.get(entry.recommendation_id) ??
            `Цель #${entry.recommendation_id}`,
        reason: BULK_SKIP_REASON_LABELS[entry.reason] ?? entry.reason,
    }))
}

/** Name and value of a target the backend still knows about, or nothing. */
function skippedTitle(entry: ProgressionBulkSkipped): string | null {
    if (!entry.exercise_name) return null
    if (entry.value == null) return entry.exercise_name
    return `${entry.exercise_name} · ${formatTargetValue(
        entry.value,
        entry.unit === 'seconds' ? 'seconds' : 'kg',
    )}`
}
