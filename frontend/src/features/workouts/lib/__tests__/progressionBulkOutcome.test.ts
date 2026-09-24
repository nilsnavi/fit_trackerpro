/**
 * SPEC-006 §58: the undo journal — the chain of sweeps the server can still put
 * back, named the way the list names its rows.
 */
import { describeUndoSweeps, describeUnrestoredTargets } from '../progressionBulkOutcome'
import type { ProgressionRecommendation } from '@features/workouts/types/workouts'

const row = (overrides: Partial<ProgressionRecommendation>): ProgressionRecommendation =>
    ({
        policy: 'DOUBLE_PROGRESSION',
        reason_code: 'REP_RANGE_COMPLETED',
        reason_text: '',
        confidence: 'low',
        ...overrides,
    }) as ProgressionRecommendation

const sweep = (overrides: Partial<Parameters<typeof describeUndoSweeps>[0][number]>) => ({
    sweep_id: 'sweep-1',
    declined_at: '2026-09-19T12:04:00+00:00',
    restorable: true,
    updated: 1,
    changed_ids: [42],
    superseded: [],
    ...overrides,
})

describe('describeUndoSweeps (SPEC-006 §58)', () => {
    it('counts the targets each sweep would bring back, with the date', () => {
        const [first, second] = describeUndoSweeps(
            [sweep({ changed_ids: [42, 43], updated: 2 }), sweep({ sweep_id: 'sweep-2' })],
            [row({ id: 42, exercise_name: 'Bench Press', actual_selected_value: 82.5 }), row({ id: 43 })],
        )

        expect(first.sweepId).toBe('sweep-1')
        expect(first.changedIds).toEqual([42, 43])
        expect(first.title).toMatch(/^2 цели · /)
        expect(first.title).toContain('2026')
        expect(second.title).toMatch(/^1 цель · /)
    })

    it('names the goals of each sweep from the rows the screen already has', () => {
        const [entry] = describeUndoSweeps(
            [sweep({ changed_ids: [42, 43] })],
            [
                row({ id: 42, exercise_name: 'Bench Press', actual_selected_value: 82.5 }),
                row({
                    id: 43,
                    exercise_name: 'Squat',
                    actual_selected_value: 62.5,
                    effective_policy: 'TIME_PROGRESSION',
                }),
            ],
        )

        // The seconds form follows the target's policy, exactly like the list.
        expect(entry.names).toBe('Bench Press · 82.5 кг, Squat · 62.5 сек')
    })

    it('keeps the chain in the order the server sent it', () => {
        const rows = describeUndoSweeps(
            [sweep({ sweep_id: 'newest' }), sweep({ sweep_id: 'older' })],
            [],
        )

        expect(rows.map((entry) => entry.sweepId)).toEqual(['newest', 'older'])
    })

    it('says a sweep has nothing to undo instead of vanishing from the journal', () => {
        // The action stays visible with the goals that replaced it: hiding it would
        // leave its stamp on rows no undo could reach, with nothing said about it.
        const [entry] = describeUndoSweeps(
            [
                sweep({
                    restorable: false,
                    updated: 0,
                    changed_ids: [],
                    superseded: [{ recommendation_id: 42, superseded_by: 43 }],
                }),
            ],
            [
                row({ id: 43, exercise_name: 'Bench Press', actual_selected_value: 87.5 }),
            ],
        )

        expect(entry.restorable).toBe(false)
        expect(entry.title).toBe('Отменять нечего · 19 сентября 2026 г.')
        // The replacement is the actionable half: it says which goal owns the slot.
        expect(entry.names).toBe('Слоты занимают: Bench Press · 87.5 кг')
        expect(entry.changedIds).toEqual([])
        // The report is measured against everything the sweep holds, not only the
        // part that could come back — otherwise its result would not add up.
        expect(entry.addressedIds).toEqual([42])
    })

    it('names a goal the server could not replace, without inventing an id', () => {
        const [entry] = describeUndoSweeps(
            [
                sweep({
                    restorable: false,
                    updated: 0,
                    changed_ids: [],
                    superseded: [
                        { recommendation_id: 42, superseded_by: null },
                        { recommendation_id: 43, superseded_by: null },
                    ],
                }),
            ],
            [],
        )

        expect(entry.names).toBe('Слоты перекрыты более новыми целями (2)')
        expect(entry.addressedIds).toEqual([42, 43])
    })

    it('counts what comes back and what a newer goal took over', () => {
        // One sweep, two outcomes: naming only the first would over-promise the
        // undo, so the replaced goal is said out loud next to the ones that return.
        const [entry] = describeUndoSweeps(
            [
                sweep({
                    updated: 1,
                    changed_ids: [42],
                    superseded: [{ recommendation_id: 43, superseded_by: 44 }],
                }),
            ],
            [row({ id: 42, exercise_name: 'Bench Press', actual_selected_value: 82.5 })],
        )

        expect(entry.restorable).toBe(true)
        expect(entry.title).toMatch(/^1 цель · /)
        expect(entry.names).toBe('Bench Press · 82.5 кг (ещё 1 перекрыто)')
        expect(entry.addressedIds).toEqual([42, 43])
    })

    it('still counts a sweep whose targets are off the list', () => {
        // Names must never be invented: a goal the screen cannot see (or an id the
        // backend knows and the list does not) is shown as the target it is.
        const [entry] = describeUndoSweeps([sweep({ changed_ids: [999999, 42] })], [
            row({ id: 42, exercise_name: 'Bench Press' }),
        ])

        expect(entry.names).toBe('Цель #999999, Bench Press')
        expect(entry.title).toMatch(/^2 цели/)
    })

    it('leaves the date out rather than inventing one', () => {
        const [entry] = describeUndoSweeps([sweep({ declined_at: null })], [])

        expect(entry.title).toBe('1 цель')
    })

    it('has nothing to show for an empty chain', () => {
        expect(describeUndoSweeps([], [])).toEqual([])
    })
})

describe('describeUnrestoredTargets (SPEC-006 §58)', () => {
    const result = (changedIds: number[], skipped: number[] = []) => ({
        changed_ids: changedIds,
        skipped: skipped.map((id) => ({ recommendation_id: id, reason: 'not_found' as const })),
    })

    it('says nothing when the server answered for every target', () => {
        expect(
            describeUnrestoredTargets([42, 43], result([42, 43]), [row({ id: 42 })]),
        ).toEqual([])
    })

    it('names a goal that came back on by hand, with the reason the list proves', () => {
        // The sweep no longer holds it, so the server is silent about it — but the
        // row in front of the user says it is already prefilling again.
        const [entry] = describeUnrestoredTargets(
            [42, 43],
            result([42]),
            [
                row({ id: 42 }),
                row({
                    id: 43,
                    exercise_name: 'Squat',
                    actual_selected_value: 62.5,
                    prefill_declined: false,
                }),
            ],
        )

        expect(entry).toEqual({
            recommendationId: 43,
            title: 'Squat · 62.5 кг',
            reason: 'Автоподстановка уже была включена',
        })
    })

    it('says a goal is gone when the list no longer has it', () => {
        const [entry] = describeUnrestoredTargets([999999], result([]), [row({ id: 42 })])

        expect(entry.title).toBe('Цель #999999')
        expect(entry.reason).toBe('Цель больше не актуальна')
    })

    it('does not repeat what the server already reported', () => {
        // The server's own explanation wins; the client only fills the silence.
        expect(
            describeUnrestoredTargets([42, 43], result([43], [42]), [row({ id: 42 })]),
        ).toEqual([])
    })

    it('names each target once, however the chain was addressed', () => {
        const entries = describeUnrestoredTargets(
            [42, 42, 43],
            result([]),
            [row({ id: 42 }), row({ id: 43 })],
        )

        expect(entries.map((entry) => entry.recommendationId)).toEqual([42, 43])
    })
})
