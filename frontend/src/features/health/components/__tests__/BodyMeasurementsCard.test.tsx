import { fireEvent, render, screen } from '@testing-library/react'
import type { BodyMeasurement, BodyMeasurementType } from '@features/health/types/metrics'
import { BodyMeasurementsCard } from '../BodyMeasurementsCard'

function measurement(
    id: number,
    type: BodyMeasurementType,
    valueCm: number,
    measuredAt: string,
): BodyMeasurement {
    return {
        id,
        user_id: 1,
        measurement_type: type,
        value_cm: valueCm,
        measured_at: measuredAt,
        created_at: measuredAt,
        updated_at: measuredAt,
    }
}

describe('BodyMeasurementsCard', () => {
    it('показывает пустое состояние, когда замеров нет', () => {
        render(<BodyMeasurementsCard items={[]} />)

        expect(screen.getByTestId('body-measurements-empty')).toHaveTextContent('Замеров пока нет')
    })

    it('показывает скелетон на время загрузки и не врёт данными', () => {
        render(<BodyMeasurementsCard items={[]} isLoading />)

        expect(screen.getByTestId('body-measurements-loading')).toBeInTheDocument()
        expect(screen.queryByTestId('body-measurements-empty')).not.toBeInTheDocument()
    })

    it('на ошибке предлагает повтор и не подменяет её пустотой', () => {
        const onRetry = jest.fn()
        render(<BodyMeasurementsCard items={[]} isError onRetry={onRetry} />)

        expect(screen.getByTestId('body-measurements-error')).toBeInTheDocument()
        expect(screen.queryByTestId('body-measurements-empty')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Повторить/ }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('рисует реальные значения с дельтой и график по двум и более замерам', () => {
        render(
            <BodyMeasurementsCard
                items={[
                    measurement(1, 'waist', 81, '2026-02-01T08:00:00Z'),
                    measurement(2, 'waist', 79.5, '2026-02-15T08:00:00Z'),
                    measurement(3, 'chest', 101, '2026-01-05T08:00:00Z'),
                ]}
            />,
        )

        expect(screen.getByTestId('measurement-waist')).toHaveTextContent('79.5')
        expect(screen.getByTestId('measurement-waist')).toHaveTextContent('−1.5 см')
        expect(screen.getByTestId('measurement-chest')).toHaveTextContent('101')

        // Тип с самым свежим замером (талия, два замера) выбран для графика.
        expect(screen.getByTestId('body-measurements-chart')).toBeInTheDocument()
    })

    it('объясняет, что для линии нужен второй замер', () => {
        render(<BodyMeasurementsCard items={[measurement(1, 'waist', 81, '2026-02-01T08:00:00Z')]} />)

        expect(screen.getByTestId('measurement-single-point')).toHaveTextContent(
            'Пока один замер',
        )
        expect(screen.queryByTestId('body-measurements-chart')).not.toBeInTheDocument()
    })
})
