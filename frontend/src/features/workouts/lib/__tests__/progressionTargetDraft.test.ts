/**
 * SPEC-006 §58: the inline target editor sends only what the user changed, so an
 * edit can never silently reset the rest of the policy.
 */
import {
    draftFor,
    effectivePolicy,
    parseTargetDraft,
    type TargetDraft,
} from '../progressionTargetDraft'
import type { ProgressionRecommendation } from '@features/workouts/types/workouts'

const TARGET = {
    id: 42,
    exercise_id: 1,
    exercise_name: 'Bench Press',
    scope_key: 'u1:e1:t3:te4',
    policy: 'DOUBLE_PROGRESSION',
    effective_policy: 'DOUBLE_PROGRESSION',
    status: 'INCREASE',
    lifecycle_status: 'accepted',
    previous_value: 80,
    recommended_value: 82.5,
    actual_selected_value: 82.5,
    difference: 2.5,
    reps_min: 8,
    reps_max: 12,
    prefill_declined: false,
    reason_code: 'REP_RANGE_COMPLETED',
    reason_text: '',
    confidence: 'high',
} as ProgressionRecommendation

function draft(overrides: Partial<TargetDraft> = {}): TargetDraft {
    return { ...draftFor(TARGET), ...overrides }
}

describe('progressionTargetDraft (SPEC-006 §58)', () => {
    it('prefers the effective policy over the recorded one', () => {
        expect(effectivePolicy(TARGET)).toBe('DOUBLE_PROGRESSION')
        expect(
            effectivePolicy({ ...TARGET, policy: 'MANUAL', effective_policy: 'LINEAR' }),
        ).toBe('LINEAR')
        expect(effectivePolicy({ ...TARGET, effective_policy: null, policy: 'MANUAL' })).toBe(
            'MANUAL',
        )
    })

    it('prefills the draft from the target as it stands now', () => {
        expect(draft()).toEqual({ value: '82.5', policy: 'DOUBLE_PROGRESSION', repsMin: '8', repsMax: '12' })
        expect(
            draftFor({ ...TARGET, actual_selected_value: null, reps_min: null, reps_max: null }),
        ).toEqual({ value: '82.5', policy: 'DOUBLE_PROGRESSION', repsMin: '', repsMax: '' })
    })

    it('sends nothing when nothing changed', () => {
        expect(parseTargetDraft(TARGET, draft())).toEqual({ payload: {}, error: null })
    })

    it('sends only the value when only the value changed', () => {
        expect(parseTargetDraft(TARGET, draft({ value: '90' }))).toEqual({
            payload: { value: 90 },
            error: null,
        })
    })

    it('tolerates float noise and a comma as the decimal separator', () => {
        expect(parseTargetDraft(TARGET, draft({ value: '82.50' })).payload).toEqual({})
        expect(parseTargetDraft(TARGET, draft({ value: '91,5' })).payload).toEqual({ value: 91.5 })
    })

    it('sends the type and both bounds when the range changed', () => {
        expect(parseTargetDraft(TARGET, draft({ policy: 'LINEAR', repsMin: '5' }))).toEqual({
            payload: { type: 'LINEAR', reps_min: 5, reps_max: 12 },
            error: null,
        })
    })

    it('leaves an absent range alone instead of inventing one', () => {
        const withoutRange = { ...TARGET, reps_min: null, reps_max: null }
        expect(parseTargetDraft(withoutRange, draftFor(withoutRange))).toEqual({
            payload: {},
            error: null,
        })
    })

    it('refuses an unordered or non-integer rep range', () => {
        expect(parseTargetDraft(TARGET, draft({ repsMin: '15' })).error).toBe(
            'Минимум повторов не может быть больше максимума',
        )
        expect(parseTargetDraft(TARGET, draft({ repsMax: '' })).error).toBe(
            'Укажите диапазон повторов целыми числами',
        )
        expect(parseTargetDraft(TARGET, draft({ repsMin: '7.5' })).error).toBe(
            'Укажите диапазон повторов целыми числами',
        )
    })

    it('refuses a value that is not a positive number', () => {
        expect(parseTargetDraft(TARGET, draft({ value: '' })).error).toBe(
            'Введите значение больше 0',
        )
        expect(parseTargetDraft(TARGET, draft({ value: '0' })).error).toBe(
            'Введите значение больше 0',
        )
    })
})
