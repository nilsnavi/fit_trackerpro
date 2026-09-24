/**
 * Блок «Здоровье сегодня» на главной (WS2-2): реальные данные, честные состояния
 * загрузки/ошибки/отсутствия данных и быстрое добавление воды.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAddWaterEntryMutation } from '@features/health/hooks/useHealthQueries'
import { useHomeHealthWidgets } from '@features/home/hooks/useHomeHealthWidgets'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { HomeHealthSection } from '../HomeHealthSection'

jest.mock('@features/home/hooks/useHomeHealthWidgets', () => ({
    useHomeHealthWidgets: jest.fn(),
}))
jest.mock('@features/health/hooks/useHealthQueries', () => ({
    useAddWaterEntryMutation: jest.fn(),
}))
jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: jest.fn(),
}))

const mockedWidgets = useHomeHealthWidgets as jest.Mock
const mockedAddWater = useAddWaterEntryMutation as jest.Mock
const mockedTelegram = useTelegramWebApp as jest.Mock

const waterData = { current: 500, goal: 2000, unit: 'мл' }
const glucoseData = { value: 5.2, unit: 'ммоль/л', status: 'normal' as const }
const wellnessData = { score: 70, mood: 'good' as const }

function renderSection() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <HomeHealthSection />
        </MemoryRouter>,
    )
}

describe('HomeHealthSection', () => {
    let mutate: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        mutate = jest.fn()
        mockedAddWater.mockReturnValue({ mutate })
        mockedTelegram.mockReturnValue({ hapticFeedback: jest.fn() })
        mockedWidgets.mockReturnValue({
            water: waterData,
            glucose: glucoseData,
            wellness: wellnessData,
            isPending: false,
            isError: false,
            refetch: jest.fn(),
        })
    })

    it('показывает виджеты с реальными значениями', () => {
        renderSection()

        expect(screen.getByText('Здоровье сегодня')).toBeInTheDocument()
        expect(screen.getByText('500')).toBeInTheDocument()
        expect(screen.getByText('/2000')).toBeInTheDocument()
        expect(screen.getByTestId('glucose-widget')).toHaveTextContent('5.2')
        expect(screen.getByTestId('wellness-widget')).toHaveTextContent('70')
    })

    it('без данных показывает заглушки вместо нулей', () => {
        mockedWidgets.mockReturnValue({
            water: null,
            glucose: null,
            wellness: null,
            isPending: false,
            isError: false,
            refetch: jest.fn(),
        })

        renderSection()

        expect(screen.getAllByText('Нет данных')).toHaveLength(3)
    })

    it('во время загрузки показывает скелеты, а не выдуманные значения', () => {
        mockedWidgets.mockReturnValue({
            water: null,
            glucose: null,
            wellness: null,
            isPending: true,
            isError: false,
            refetch: jest.fn(),
        })

        renderSection()

        expect(screen.getAllByTestId('health-widget-skeleton')).toHaveLength(3)
        expect(screen.queryByTestId('water-widget')).not.toBeInTheDocument()
    })

    it('при ошибке предлагает повторить запрос', () => {
        const refetch = jest.fn()
        mockedWidgets.mockReturnValue({
            water: null,
            glucose: null,
            wellness: null,
            isPending: false,
            isError: true,
            refetch,
        })

        renderSection()
        fireEvent.click(screen.getByTestId('home-health-retry'))

        expect(screen.getByText('Данные здоровья не загрузились')).toBeInTheDocument()
        expect(refetch).toHaveBeenCalledTimes(1)
    })

    it('добавляет 250 мл воды и не уводит со страницы', () => {
        renderSection()
        fireEvent.click(screen.getByTestId('water-widget-add'))

        expect(mutate).toHaveBeenCalledWith({ amount: 250 })
    })

    it('по кнопке «Все» открывает экран здоровья', () => {
        renderSection()
        fireEvent.click(screen.getByTestId('home-health-all'))

        expect(screen.getByTestId('home-health-section')).toBeInTheDocument()
    })
})
