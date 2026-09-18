/**
 * SPEC-006 §58: the bulk toolbar's pure part — what a bulk request may contain,
 * and how the selection follows the visible list.
 */
import {
    EMPTY_BULK_DRAFT,
    describeBulkSkips,
    parseBulkDraft,
    selectableIds,
    toggleSelection,
} from '../progressionBulkDraft'
import type { ProgressionRecommendation } from '@features/workouts/types/workouts'

describe('parseBulkDraft (SPEC-006 §58)', () => {
    it('sends only the policy when that is all the user chose', () => {
        const { payload, error } = parseBulkDraft({ ...EMPTY_BULK_DRAFT, policy: 'LINEAR' })
        expect(error).toBeNull()
        expect(payload).toEqual({ type: 'LINEAR' })
    })

    it('sends only the rep range when the policy is left alone', () => {
        const { payload, error } = parseBulkDraft({
            policy: '',
            repsMin: '5',
            repsMax: '8',
        })
        expect(error).toBeNull()
        expect(payload).toEqual({ reps_min: 5, reps_max: 8 })
    })

    it('never resets a policy that was not chosen', () => {
        // A missing policy field means "leave every scope's policy as it is", so
        // the draft must not carry MANUAL by accident.
        const { payload } = parseBulkDraft({ policy: '', repsMin: '10', repsMax: '10' })
        expect(payload.type).toBeUndefined()
        expect(payload.reps_min).toBe(10)
        expect(payload.reps_max).toBe(10)
    })

    it('asks for something to apply when the draft is empty', () => {
        const { payload, error } = parseBulkDraft(EMPTY_BULK_DRAFT)
        expect(payload).toEqual({})
        expect(error).toBe('Выберите политику или укажите диапазон повторов')
    })

    it('refuses a half-typed range', () => {
        // One-sided ranges would be resolved against each scope's own inherited
        // bound — a per-target surprise, so the toolbar asks for both bounds.
        expect(parseBulkDraft({ ...EMPTY_BULK_DRAFT, repsMin: '5' }).error).toBe(
            'Укажите оба значения диапазона повторов',
        )
        expect(parseBulkDraft({ ...EMPTY_BULK_DRAFT, repsMax: '8' }).error).toBe(
            'Укажите оба значения диапазона повторов',
        )
    })

    it('refuses an unordered or non-integer range before calling the backend', () => {
        const reversed = parseBulkDraft({ ...EMPTY_BULK_DRAFT, repsMin: '15', repsMax: '12' })
        expect(reversed.payload).toEqual({})
        expect(reversed.error).toBe('Минимум повторов не может быть больше максимума')

        const fractional = parseBulkDraft({ ...EMPTY_BULK_DRAFT, repsMin: '5.5', repsMax: '8' })
        expect(fractional.error).toBe('Укажите диапазон повторов целыми числами')

        const negative = parseBulkDraft({ ...EMPTY_BULK_DRAFT, repsMin: '-1', repsMax: '8' })
        expect(negative.error).toBe('Укажите диапазон повторов целыми числами')
    })

    it('validates the range even when a policy is chosen too', () => {
        const { error } = parseBulkDraft({ policy: 'LINEAR', repsMin: '', repsMax: '8' })
        expect(error).toBe('Укажите оба значения диапазона повторов')
    })
})

describe('describeBulkSkips (SPEC-006 §58)', () => {
    const row = (overrides: Partial<ProgressionRecommendation>): ProgressionRecommendation =>
        ({
            policy: 'DOUBLE_PROGRESSION',
            reason_code: 'REP_RANGE_COMPLETED',
            reason_text: '',
            confidence: 'low',
            ...overrides,
        }) as ProgressionRecommendation

    it('names a skipped target the backend still knows, value included', () => {
        const views = describeBulkSkips([
            {
                recommendation_id: 42,
                reason: 'already_disabled',
                exercise_id: 1,
                exercise_name: 'Жим лёжа',
                value: 82.5,
                unit: 'kg',
            },
        ])
        expect(views).toEqual([
            {
                recommendationId: 42,
                title: 'Жим лёжа · 82.5 кг',
                reason: 'Автоподстановка уже была выключена',
            },
        ])
    })

    it('follows the backend unit for timed targets', () => {
        const [view] = describeBulkSkips([
            {
                recommendation_id: 7,
                reason: 'already_disabled',
                exercise_name: 'Планка',
                value: 60,
                unit: 'seconds',
            },
        ])
        expect(view.title).toBe('Планка · 60 сек')
    })

    it('falls back to the row the user picked when the id is gone', () => {
        // The row was on screen when the user selected it and stopped being a
        // target before the backend resolved the call: only the client can name it.
        const [view] = describeBulkSkips(
            [{ recommendation_id: 43, reason: 'not_found' }],
            [row({ id: 43, exercise_id: 2, exercise_name: 'Присед', actual_selected_value: 62.5 })],
        )
        expect(view.title).toBe('Присед · 62.5 кг')
        expect(view.reason).toBe('Цель не найдена: удалена, чужая или уже не актуальна')
    })

    it('keeps the bare id when nothing can name the target', () => {
        const [view] = describeBulkSkips([{ recommendation_id: 999999, reason: 'not_found' }])
        expect(view.title).toBe('Цель #999999')
    })

    it('explains every skipped target, in the order the backend reported them', () => {
        const views = describeBulkSkips(
            [
                { recommendation_id: 43, reason: 'not_found' },
                { recommendation_id: 42, reason: 'already_disabled', exercise_name: 'Жим лёжа', value: 82.5, unit: 'kg' },
            ],
            [row({ id: 43, exercise_name: 'Присед', actual_selected_value: 62.5 })],
        )
        expect(views.map((view) => view.recommendationId)).toEqual([43, 42])
    })
})

describe('selection helpers (SPEC-006 §58)', () => {
    it('adds and removes the same target, keeping the order', () => {
        expect(toggleSelection([], 42)).toEqual([42])
        expect(toggleSelection([42], 43)).toEqual([42, 43])
        expect(toggleSelection([42, 43], 42)).toEqual([43])
    })

    it('only collects ids that can actually be addressed', () => {
        const base = {
            policy: 'LINEAR' as const,
            reason_code: 'REP_RANGE_COMPLETED',
            reason_text: '',
            confidence: 'low' as const,
        }
        // A non-persisted preview has no id and must not be part of a bulk action.
        expect(selectableIds([{ ...base, id: 42 }, { ...base, id: null }, base])).toEqual([
            42,
        ])
    })
})
