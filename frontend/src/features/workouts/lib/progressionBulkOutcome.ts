/**
 * SPEC-006 §58: after a bulk action — what it did, and what can still be undone.
 *
 * A sweep is often the wrong decision, and the moment the user notices is after
 * the fact: leaving the screen, reloading, or later on another device. So the
 * undo is not this screen's private state. The server stamps every target a bulk
 * switch-off changed with one sweep id and offers the sweeps that still have
 * targets switched off; the journal below is that chain, and the report is what
 * the action just made actually did. They are deliberately different things: the
 * report is an event with its counts and skip reasons, the journal is a state
 * that outlives the screen.
 */
import { formatDate, pluralizeRu } from '@features/workouts/lib/workoutDetailFormatters'
import { describeUndoTargets } from '@features/workouts/lib/progressionBulkDraft'
import type { BulkSkipView } from '@features/workouts/lib/progressionBulkDraft'
import { targetLabel } from '@features/workouts/lib/progressionTargetDraft'
import type {
    ProgressionBulkResult,
    ProgressionPrefillSweep,
    ProgressionPrefillSweepSuperseded,
    ProgressionRecommendation,
} from '@features/workouts/types/workouts'

export type BulkOutcomeKind =
    /** A bulk switch-off: full report, and its sweep joins the journal. */
    | 'disable'
    /** A plan edit: a report, with nothing to come back to. */
    | 'apply'
    /** The undo itself: its own result, and no undo of its own. */
    | 'enable'

/**
 * What the last bulk action did, as the notice reports it.
 *
 * In-session only: the server stores the *decision* of a sweep (its targets), not
 * this report, so how many goals an action addressed or left alone cannot be
 * reconstructed on the next visit — and is not invented.
 */
export interface BulkOutcome {
    kind: BulkOutcomeKind
    updated: number
    /** How many targets the action addressed (null for «всем»). */
    total: number | null
    /** Targets left alone, named and explained. */
    skips: BulkSkipView[]
}

/**
 * The goals an undo promised but the server did not report on.
 *
 * A sweep address resolves to what the sweep *still* holds, so a goal switched
 * back on between the journal being read and the button being pressed is simply
 * absent from the answer — and a bare «3 из 4» would leave the user guessing why.
 * The client can name that gap honestly, because it holds both sides: the ids it
 * addressed and the rows it was showing. A target only leaves a sweep by being
 * switched on, or by leaving the user's data altogether — and the list says which
 * of the two happened, so nothing is invented here.
 */
export function describeUnrestoredTargets(
    addressedIds: number[],
    result: Pick<ProgressionBulkResult, 'changed_ids' | 'skipped'>,
    items: ProgressionRecommendation[],
): BulkSkipView[] {
    const answered = new Set<number>([
        ...result.changed_ids,
        ...result.skipped.map((entry) => entry.recommendation_id),
    ])
    const rows = new Map<number, ProgressionRecommendation>()
    for (const item of items) {
        if (item.id != null) rows.set(item.id, item)
    }
    return [...new Set(addressedIds)]
        .filter((id) => !answered.has(id))
        .map((id) => {
            const row = rows.get(id)
            return {
                recommendationId: id,
                title: row ? targetLabel(row) : `Цель #${id}`,
                reason: !row
                    ? 'Цель больше не актуальна'
                    : row.prefill_declined
                      ? 'Подстановка не изменилась'
                      : 'Автоподстановка уже была включена',
            }
        })
}

/** One sweep the journal shows, undoable or spent. */
export interface UndoSweepRow {
    sweepId: string
    /** True when the undo still switches something back on. */
    restorable: boolean
    /** Exactly the targets this sweep's undo brings back. */
    changedIds: number[]
    /**
     * Everything the sweep still holds — the goals that come back plus the ones a
     * newer target replaced. The report needs the whole set: the addressed ids are
     * what an outcome is measured against, not just the ones that could return.
     */
    addressedIds: number[]
    /** «2 цели · 19 сентября 2026 г.», or «Отменять нечего · …» when spent. */
    title: string
    /** Who comes back, or who took the goals over — named as the list names them. */
    names: string
}

/**
 * Who a spent sweep's goals belong to now, named like the list names its rows.
 *
 * The replacement is the actionable half of the answer: the entry cannot return
 * anything, but it says which target owns those slots instead. When the server
 * cannot name an owner (the record is gone), the count is still honest and no id
 * is invented.
 */
function describeReplacedMembers(
    members: ProgressionPrefillSweepSuperseded[],
    items: ProgressionRecommendation[],
): string {
    const owners = members
        .map((member) => member.superseded_by)
        .filter((id): id is number => id != null)
    if (owners.length === 0) {
        return `Слоты перекрыты более новыми целями (${members.length})`
    }
    return `Слоты занимают: ${describeUndoTargets(owners, items)}`
}

/**
 * Turn the server's chain of sweeps into journal rows.
 *
 * The chain is what keeps an undo alive: the newest sweep is only one link, and a
 * run of bulk actions can be put back in any order because each sweep carries its
 * own targets. Names come from the rows the screen already has — every target the
 * server offers as restorable is on the list.
 *
 * A sweep whose members a newer target replaced is listed too, saying there is
 * nothing to switch back on. Hiding it would strand its stamp invisibly: the
 * action would be gone from the journal while its rows stayed switched off and
 * unreachable, and the user could never learn why. Acting on such a row is what
 * releases those stamps, so a spent entry is one tap from leaving the chain.
 */
export function describeUndoSweeps(
    sweeps: ProgressionPrefillSweep[],
    items: ProgressionRecommendation[],
): UndoSweepRow[] {
    return sweeps.map((sweep) => {
        const changedIds = sweep.changed_ids
        const replaced = sweep.superseded ?? []
        const addressedIds = [
            ...changedIds,
            ...replaced.map((member) => member.recommendation_id),
        ]
        const when = sweep.declined_at ? formatDate(sweep.declined_at) : ''
        if (sweep.restorable === false) {
            return {
                sweepId: sweep.sweep_id,
                restorable: false,
                changedIds,
                addressedIds,
                title: when ? `Отменять нечего · ${when}` : 'Отменять нечего',
                names: describeReplacedMembers(replaced, items),
            }
        }
        const count = changedIds.length
        const goals = pluralizeRu(count, ['цель', 'цели', 'целей'])
        const names = describeUndoTargets(changedIds, items)
        // A sweep can hold both kinds, and naming only the goals that come back
        // would over-promise the undo — the replaced ones are said out loud.
        const held = replaced.length > 0 ? ` (ещё ${replaced.length} перекрыто)` : ''
        return {
            sweepId: sweep.sweep_id,
            restorable: true,
            changedIds,
            addressedIds,
            title: when ? `${count} ${goals} · ${when}` : `${count} ${goals}`,
            names: `${names}${held}`,
        }
    })
}
