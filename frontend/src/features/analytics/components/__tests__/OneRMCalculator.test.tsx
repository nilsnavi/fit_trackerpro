import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import OneRMCalculator from '../OneRMCalculator'

const mockExercises = [
    { id: 42, name: 'Жим штанги лёжа', category: 'strength' },
    { id: 99, name: 'Бег на дорожке', category: 'cardio' },
    { id: 150, name: 'Приседания со штангой', category: 'strength' },
]

let mockIsLoading = false
let mockIsError = false

jest.mock('@features/analytics/hooks/useOneRMExercises', () => ({
    useOneRMExercises: () => ({
        exercises: mockIsLoading || mockIsError ? [] : mockExercises,
        isLoading: mockIsLoading,
        isError: mockIsError,
    }),
}))

jest.mock('@shared/ui/Modal', () => ({
    Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div data-testid="modal">{children}</div> : null,
}))

describe('OneRMCalculator', () => {
    beforeEach(() => {
        mockIsLoading = false
        mockIsError = false
        localStorage.clear()
    })

    it('renders exercise selector with API exercises', () => {
        render(<OneRMCalculator />)

        const selectorButton = screen.getByText('Выберите упражнение')
        fireEvent.click(selectorButton)

        expect(screen.getByText('Жим штанги лёжа')).toBeInTheDocument()
        expect(screen.getByText('Бег на дорожке')).toBeInTheDocument()
        expect(screen.getByText('Приседания со штангой')).toBeInTheDocument()
    })

    it('shows loading state in exercise selector', () => {
        mockIsLoading = true
        render(<OneRMCalculator />)

        const selectorButton = screen.getByText('Выберите упражнение')
        fireEvent.click(selectorButton)

        expect(screen.getByText(/Загрузка упражнений/)).toBeInTheDocument()
    })

    it('shows error state in exercise selector', () => {
        mockIsError = true
        render(<OneRMCalculator />)

        const selectorButton = screen.getByText('Выберите упражнение')
        fireEvent.click(selectorButton)

        expect(screen.getByText(/Не удалось загрузить упражнения/)).toBeInTheDocument()
    })

    it('selects exercise and computes 1RM', () => {
        render(<OneRMCalculator />)

        // Open selector and pick an exercise
        fireEvent.click(screen.getByText('Выберите упражнение'))
        fireEvent.click(screen.getByText('Жим штанги лёжа'))

        // Enter weight and reps via spinbutton inputs
        const inputs = screen.getAllByRole('spinbutton')
        fireEvent.change(inputs[0], { target: { value: '100' } })
        fireEvent.change(inputs[1], { target: { value: '5' } })

        // Epley: 100 * (1+5/30) = 116.67 → 116.7
        // Brzycki: 100 * (1+0.0333*5) = 116.65 → 116.7
        // Average ≈ 116.7
        expect(screen.getAllByText('116.7').length).toBeGreaterThanOrEqual(1)
    })

    it('saves record with real exercise ID to localStorage', () => {
        render(<OneRMCalculator />)

        // Select exercise
        fireEvent.click(screen.getByText('Выберите упражнение'))
        fireEvent.click(screen.getByText('Жим штанги лёжа'))

        // Enter weight and reps
        const inputs = screen.getAllByRole('spinbutton')
        fireEvent.change(inputs[0], { target: { value: '80' } })
        fireEvent.change(inputs[1], { target: { value: '8' } })

        // Click save button (contains text "Сохранить")
        const saveButton = screen.getByText('Сохранить')
        fireEvent.click(saveButton)

        // Verify localStorage
        const stored = JSON.parse(localStorage.getItem('oneRMHistory') || '[]')
        expect(stored).toHaveLength(1)
        expect(stored[0].exerciseId).toBe(42)
        expect(stored[0].exerciseName).toBe('Жим штанги лёжа')
    })

    it('restores history record with valid API exercise ID', () => {
        const historyRecord = {
            id: 'test-1',
            exerciseId: 42,
            exerciseName: 'Жим штанги лёжа',
            weight: 80,
            reps: 8,
            oneRM: 101,
            formula: 'average',
            createdAt: new Date().toISOString(),
        }
        localStorage.setItem('oneRMHistory', JSON.stringify([historyRecord]))

        render(<OneRMCalculator />)

        // Find and click the history button (it has count badge)
        const buttons = screen.getAllByRole('button')
        const historyBtn = buttons.find((btn) => btn.textContent?.includes('1'))
        expect(historyBtn).toBeTruthy()
        fireEvent.click(historyBtn!)

        // Click on the history record text
        const recordElement = screen.getByText(/80 кг/)
        fireEvent.click(recordElement.closest('[class*="cursor-pointer"]')!)

        // Verify form is populated
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs[0]).toHaveValue(80)
        expect(inputs[1]).toHaveValue(8)
    })

    it('handles history record with old mock ID gracefully', () => {
        const oldMockRecord = {
            id: 'old-1',
            exerciseId: 3,
            exerciseName: 'Становая тяга',
            weight: 120,
            reps: 5,
            oneRM: 140,
            formula: 'average',
            createdAt: new Date().toISOString(),
        }
        localStorage.setItem('oneRMHistory', JSON.stringify([oldMockRecord]))

        render(<OneRMCalculator />)

        // Find and click the history button
        const buttons = screen.getAllByRole('button')
        const historyBtn = buttons.find((btn) => btn.textContent?.includes('1'))
        expect(historyBtn).toBeTruthy()
        fireEvent.click(historyBtn!)

        // Click on the old record — should not crash
        const recordElement = screen.getByText(/120 кг/)
        fireEvent.click(recordElement.closest('[class*="cursor-pointer"]')!)

        // Verify form is populated with the fallback name
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs[0]).toHaveValue(120)
        expect(inputs[1]).toHaveValue(5)
        // The exercise name from fallback should be shown
        expect(screen.getByText('Становая тяга')).toBeInTheDocument()
    })
})
