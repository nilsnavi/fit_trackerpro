import { render, screen, fireEvent } from '@testing-library/react'
import { ProgressionRecommendationCard } from './ProgressionRecommendationCard'
import type { ProgressionRecommendation } from '@features/workouts/types/workouts'

function makeRecommendation(
    overrides: Partial<ProgressionRecommendation> = {},
): ProgressionRecommendation {
    return {
        id: 1,
        exercise_id: 1,
        policy: 'DOUBLE_PROGRESSION',
        policy_version: 'DOUBLE_PROGRESSION_V1',
        status: 'INCREASE',
        lifecycle_status: 'generated',
        previous_value: 80,
        recommended_value: 82.5,
        difference: 2.5,
        previous_reps: 12,
        recommended_reps: 12,
        reps_min: 8,
        reps_max: 12,
        reason_code: 'REP_RANGE_COMPLETED',
        reason_text: 'Все три целевых рабочих подхода достигли верхней границы 12 повторений.',
        confidence: 'high',
        source_session_id: 42,
        ...overrides,
    }
}

describe('ProgressionRecommendationCard (SPEC-006)', () => {
    it('shows next target with status, policy and reason', () => {
        render(<ProgressionRecommendationCard recommendation={makeRecommendation()} />)

        expect(screen.getByText('Следующая цель 82.5 кг')).toBeInTheDocument()
        expect(screen.getByText('↑ +2.5')).toBeInTheDocument()
        expect(screen.getByText(/Увеличиваем нагрузку · 8–12 повторов/)).toBeInTheDocument()
        expect(screen.getByText(/Двойная прогрессия/)).toBeInTheDocument()
        expect(screen.getByTestId('progression-reason')).toHaveTextContent(
            /верхней границы 12 повторений/,
        )
    })

    it('explains the recommendation in the "Почему?" sheet', async () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation()}
                previousSets={[
                    { set_number: 1, reps: 12, weight: 80 },
                    { set_number: 2, reps: 12, weight: 80 },
                    { set_number: 3, reps: 12, weight: 80 },
                ]}
            />,
        )

        fireEvent.click(screen.getByTestId('progression-why'))

        // The sheet is lazy-loaded, so wait for the chunk to resolve.
        const sheet = await screen.findByTestId('progression-why-sheet')
        expect(sheet).toBeInTheDocument()
        // The sheet title is rendered by the shared Modal shell.
        expect(screen.getByText('Почему 82.5 кг?')).toBeInTheDocument()
        expect(sheet).toHaveTextContent('Прошлая тренировка')
        expect(sheet).toHaveTextContent('80 кг × 12')
        expect(sheet).toHaveTextContent('REP_RANGE_COMPLETED')
        expect(sheet).toHaveTextContent('Следующая цель: 82.5 кг × 8–12')
    })

    it('renders the KEEP case without a fake increase', () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation({
                    status: 'KEEP',
                    recommended_value: 80,
                    difference: 0,
                    reason_code: 'TARGET_NOT_COMPLETED',
                    reason_text: 'Для увеличения веса необходимо 12 повторений во всех целевых подходах.',
                })}
            />,
        )

        expect(screen.getByText('Оставляем 80 кг')).toBeInTheDocument()
        expect(screen.queryByText(/↑/)).not.toBeInTheDocument()
    })

    it('renders the DELOAD case with a warning tone', () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation({
                    status: 'DELOAD',
                    recommended_value: 90,
                    previous_value: 100,
                    difference: -10,
                    reason_code: 'FAILURE_THRESHOLD_REACHED',
                    reason_text: 'Цель не достигнута в 3 тренировках подряд.',
                    failure_streak: 3,
                })}
            />,
        )

        const card = screen.getByTestId('progression-recommendation')
        expect(card).toHaveAttribute('data-status', 'DELOAD')
        expect(screen.getByText('Снижаем 90 кг')).toBeInTheDocument()
    })

    it('renders insufficient data without inventing a value', () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation({
                    id: null,
                    status: 'INSUFFICIENT_DATA',
                    recommended_value: null,
                    difference: null,
                    reason_code: 'INSUFFICIENT_RPE_DATA',
                    reason_text: 'Недостаточно данных RPE.',
                    confidence: 'low',
                })}
            />,
        )

        expect(screen.getByText('Недостаточно данных')).toBeInTheDocument()
        expect(
            screen.getByText(/Завершите ещё одну тренировку/),
        ).toBeInTheDocument()
        expect(screen.queryByTestId('progression-accept')).not.toBeInTheDocument()
    })

    it('accepts and rejects only stored recommendations', () => {
        const onAccept = jest.fn()
        const onReject = jest.fn()
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation()}
                onAccept={onAccept}
                onReject={onReject}
            />,
        )

        fireEvent.click(screen.getByTestId('progression-accept'))
        fireEvent.click(screen.getByTestId('progression-reject'))

        expect(onAccept).toHaveBeenCalledTimes(1)
        expect(onReject).toHaveBeenCalledTimes(1)
        expect(onAccept.mock.calls[0][0].recommended_value).toBe(82.5)
    })

    it('shows the recorded lifecycle decision instead of the actions', () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation({
                    lifecycle_status: 'modified',
                    actual_selected_value: 85,
                })}
                onAccept={jest.fn()}
                onReject={jest.fn()}
            />,
        )

        expect(screen.getByTestId('progression-lifecycle')).toHaveTextContent('Изменено вами')
        expect(screen.queryByTestId('progression-accept')).not.toBeInTheDocument()
    })

    it('surfaces the advisory recovery warning without changing the value', () => {
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation({
                    recovery_warning: 'Готовность организма 42% — рекомендация не изменена.',
                })}
            />,
        )

        expect(screen.getByText(/Готовность организма 42%/)).toBeInTheDocument()
        expect(screen.getByText('Следующая цель 82.5 кг')).toBeInTheDocument()
    })

    it('offers prefilling the recommended weight', () => {
        const onApply = jest.fn()
        render(
            <ProgressionRecommendationCard
                recommendation={makeRecommendation()}
                onApply={onApply}
            />,
        )

        fireEvent.click(screen.getByText('Подставить 82.5 кг'))
        expect(onApply).toHaveBeenCalledWith(82.5)
    })

    it('renders nothing when there is no recommendation', () => {
        const { container } = render(<ProgressionRecommendationCard recommendation={null} />)
        expect(container).toBeEmptyDOMElement()
    })
})
