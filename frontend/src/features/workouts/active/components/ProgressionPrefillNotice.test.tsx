import { render, screen, fireEvent } from '@testing-library/react'
import { ProgressionPrefillNotice } from './ProgressionPrefillNotice'
import {
    describeProgressionPrefill,
    revertProgressionPrefill,
} from '../lib/progressionPrefill'
import type { CompletedExercise } from '@features/workouts/types/workouts'

function makeExercise(overrides: Partial<CompletedExercise> = {}): CompletedExercise {
    return {
        exercise_id: 1,
        name: 'Bench Press',
        sets_completed: [
            {
                set_number: 1,
                set_type: 'warmup',
                completed: false,
                reps: 10,
                weight: 40,
            },
            {
                set_number: 2,
                set_type: 'working',
                completed: false,
                reps: 12,
                weight: 82.5,
                planned_weight: 80,
            },
        ],
        progression_target: {
            recommendation_id: 7,
            scope_key: 'u1:e1:t3:te4',
            value: 82.5,
            unit: 'kg',
            policy: 'DOUBLE_PROGRESSION',
            lifecycle_status: 'accepted',
        },
        ...overrides,
    }
}

describe('ProgressionPrefillNotice (SPEC-006 §58)', () => {
    it('says where the number came from and what it replaced', () => {
        render(<ProgressionPrefillNotice exercise={makeExercise()} />)

        const notice = screen.getByTestId('progression-prefill-notice')
        expect(notice).toHaveTextContent('Вес 82.5 кг подставлен принятой целью прогрессии')
        expect(notice).toHaveTextContent('В плане было 80 кг')
        // Warm-up keeps its own weight, so only the working set is revertable.
        expect(describeProgressionPrefill(makeExercise())?.plannedValue).toBe(80)
    })

    it('reverts to the planned value in one tap', () => {
        const onRevert = jest.fn()
        render(<ProgressionPrefillNotice exercise={makeExercise()} onRevert={onRevert} />)

        fireEvent.click(screen.getByTestId('progression-prefill-revert'))

        expect(onRevert).toHaveBeenCalledTimes(1)
    })

    it('offers clearing when the plan had no value at all', () => {
        render(
            <ProgressionPrefillNotice
                exercise={makeExercise({
                    sets_completed: [
                        {
                            set_number: 1,
                            set_type: 'working',
                            completed: false,
                            reps: 12,
                            planned_weight: null,
                        },
                    ],
                })}
                onRevert={jest.fn()}
            />,
        )

        expect(screen.getByTestId('progression-prefill-revert')).toHaveTextContent('Очистить')
        expect(screen.getByTestId('progression-prefill-notice')).toHaveTextContent(
            'В плане значения не было',
        )
    })

    it('labels a timed target in seconds', () => {
        render(
            <ProgressionPrefillNotice
                exercise={makeExercise({
                    sets_completed: [
                        {
                            set_number: 1,
                            set_type: 'working',
                            completed: false,
                            duration: 65,
                            planned_duration: 60,
                        },
                    ],
                    progression_target: {
                        recommendation_id: 8,
                        scope_key: 'u1:e10:t3:te4',
                        value: 65,
                        unit: 'seconds',
                        policy: 'TIME_PROGRESSION',
                        lifecycle_status: 'accepted',
                    },
                })}
                onRevert={jest.fn()}
            />,
        )

        const notice = screen.getByTestId('progression-prefill-notice')
        expect(notice).toHaveAttribute('data-unit', 'seconds')
        expect(notice).toHaveTextContent('Время 65 сек подставлено принятой целью прогрессии')
        expect(screen.getByTestId('progression-prefill-revert')).toHaveTextContent('Вернуть 60 сек')
    })

    it('renders nothing without an accepted target', () => {
        const { container } = render(
            <ProgressionPrefillNotice exercise={makeExercise({ progression_target: null })} />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('revert restores the plan and drops the marker', () => {
        const reverted = revertProgressionPrefill(makeExercise())

        expect(reverted.progression_target).toBeUndefined()
        expect(reverted.sets_completed[1].weight).toBe(80)
        expect(reverted.sets_completed[1].planned_weight).toBeUndefined()
        // The warm-up was never seeded and stays untouched.
        expect(reverted.sets_completed[0].weight).toBe(40)
        // Idempotent: reverting an exercise without a marker changes nothing.
        expect(revertProgressionPrefill(reverted)).toEqual(reverted)
    })

    it('clearing removes the value instead of writing null', () => {
        const reverted = revertProgressionPrefill(
            makeExercise({
                sets_completed: [
                    {
                        set_number: 1,
                        set_type: 'working',
                        completed: false,
                        planned_weight: null,
                    },
                ],
            }),
        )

        expect('weight' in reverted.sets_completed[0]).toBe(false)
    })
})
