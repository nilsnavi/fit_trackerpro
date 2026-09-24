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
    already_enabled: 'Автоподстановка уже была включена',
    not_found: 'Цель не найдена: удалена, чужая или уже не актуальна',
    superseded: 'Слот уже обновлён через более новую цель',
}

/**
 * Who an undo brings back, named the way the list names them.
 *
 * Undo addresses the action's own changed ids, so saying *which* goals come
 * back is the whole promise of the button — a bare count would leave the user
 * checking the switches afterwards. Long sweeps are summarised instead of
 * printing two hundred names.
 */
export function describeUndoTargets(
    changedIds: number[],
    items: ProgressionRecommendation[],
    max = 3,
): string {
    if (changedIds.length === 0) return ''
    const byId = new Map<number, string>()
    for (const item of items) {
        if (item.id != null) byId.set(item.id, targetLabel(item))
    }
    const names = changedIds.map((id) => byId.get(id) ?? `Цель #${id}`)
    const shown = names.slice(0, max)
    const rest = names.length - shown.length
    return rest > 0 ? `${shown.join(', ')} и ещё ${rest}` : shown.join(', ')
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
        reason: skipReason(entry, chosen),
    }))
}

/**
 * Why one target stayed behind, naming the goal that took the edit when we can.
 *
 * A superseded record is not a mistake the user can fix in place: the slot already
 * carries the edit, and the target that owns it now is right there in the list, so
 * the report names it instead of pointing at an id the screen does not show.
 */
function skipReason(
    entry: ProgressionBulkSkipped,
    chosen: Map<number, string>,
): string {
    if (entry.reason === 'superseded') {
        const owner = entry.superseded_by == null ? null : chosen.get(entry.superseded_by)
        if (owner) return `Слот уже обновлён через «${owner}»`
        return entry.superseded_by == null
            ? BULK_SKIP_REASON_LABELS.superseded
            : `Слот уже обновлён через цель #${entry.superseded_by}`
    }
    return BULK_SKIP_REASON_LABELS[entry.reason] ?? entry.reason
}

/**
 * True when a bulk edit changed nothing because every target it addressed belongs
 * to a slot that a newer goal already owns — the one case worth explaining
 * differently from «цели не найдены».
 */
export function allTargetsSuperseded(skipped: ProgressionBulkSkipped[]): boolean {
    return skipped.length > 0 && skipped.every((entry) => entry.reason === 'superseded')
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
