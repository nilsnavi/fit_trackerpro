import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { WorkoutsPage } from '@features/workouts/pages/WorkoutsPage'

const mockUseWorkoutsPageState = jest.fn()
const mockUseWorkoutHistoryQuery = jest.fn()
const mockUseWorkoutTemplatesQuery = jest.fn()
const mockUseAppShellHeaderRight = jest.fn()
const mockUseWorkoutTemplatePinsStore = jest.fn()

jest.mock('@features/workouts/hooks/useWorkoutsPageState', () => ({
    useWorkoutsPageState: () => mockUseWorkoutsPageState(),
}))

jest.mock('@features/workouts/hooks/useWorkoutHistoryQuery', () => ({
    useWorkoutHistoryQuery: () => mockUseWorkoutHistoryQuery(),
}))

jest.mock('@features/workouts/hooks/useWorkoutTemplatesQuery', () => ({
    useWorkoutTemplatesQuery: () => mockUseWorkoutTemplatesQuery(),
}))

jest.mock('@app/layouts/AppShellLayoutContext', () => ({
    useAppShellHeaderRight: (...args: unknown[]) => mockUseAppShellHeaderRight(...args),
}))

jest.mock('@/state/local', () => ({
    useWorkoutTemplatePinsStore: (selector: (state: {
        pinnedTemplateIds: number[]
        togglePinnedTemplate: jest.Mock
    }) => unknown) =>
        mockUseWorkoutTemplatePinsStore(selector),
}))

jest.mock('@features/profile/hooks/useProfile', () => ({
    useProfile: () => ({
        profile: null,
        stats: null,
        coachAccesses: [],
        isLoading: false,
        isGeneratingCoachCode: false,
        error: null,
        updateProfile: jest.fn(),
        updateSettings: jest.fn(),
        updateWeight: jest.fn(),
        getWeightProgress: () => null,
        generateCoachCode: jest.fn(),
        revokeCoachAccess: jest.fn(),
        exportData: jest.fn(),
        refresh: jest.fn(),
    }),
}))

function makePageState(overrides: Record<string, unknown> = {}) {
    return {
        selectedType: 'all',
        draftWorkoutId: null,
        draftTitle: null,
        draftUpdatedAt: null,
        templateToDelete: null,
        deletingTemplateId: null,
        isStartingWorkout: false,
        isRepeatingLast: false,
        isSavingTemplateFromHistory: false,
        isDeletingTemplate: false,
        handleFilterChange: jest.fn(),
        handleAddWorkout: jest.fn(),
        handleOpenCalendar: jest.fn(),
        handleOpenProgress: jest.fn(),
        handleOpenMode: jest.fn(),
        handleWorkoutClick: jest.fn(),
        handleResumeDraft: jest.fn(),
        handleStartEmpty: jest.fn(),
        handleStartLast: jest.fn(),
        handleStartFromTemplate: jest.fn(),
        handleSaveWorkoutAsTemplate: jest.fn(),
        handleEditTemplate: jest.fn(),
        handleRequestDeleteTemplate: jest.fn(),
        handleCloseDeleteModal: jest.fn(),
        handleConfirmDeleteTemplate: jest.fn(),
        ...overrides,
    }
}

function renderPage() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <WorkoutsPage />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('WorkoutsPage (critical flow)', () => {
    beforeEach(() => {
        const togglePinnedTemplate = jest.fn()
        mockUseWorkoutTemplatePinsStore.mockImplementation((selector: (state: {
            pinnedTemplateIds: number[]
            togglePinnedTemplate: jest.Mock
        }) => unknown) =>
            selector({ pinnedTemplateIds: [], togglePinnedTemplate }))

        mockUseWorkoutHistoryQuery.mockReturnValue({
            data: {
                items: [],
            },
        })

        mockUseWorkoutTemplatesQuery.mockReturnValue({
            data: {
                items: [],
            },
            isPending: false,
            error: null,
        })

        mockUseWorkoutsPageState.mockReturnValue(makePageState())
    })

    it('opens workout start sheet from the primary call to action', () => {
        const state = makePageState()
        mockUseWorkoutsPageState.mockReturnValue(state)

        renderPage()

        fireEvent.click(screen.getByTestId('start-workout-main-btn'))

        expect(screen.getByText('Пустая тренировка')).toBeInTheDocument()
        expect(screen.getByText('Создать тренировку вручную')).toBeInTheDocument()
        expect(screen.getByText('Из шаблона')).toBeInTheDocument()
    })

    it('starts workout from template via quick-start chip', () => {
        const state = makePageState()
        mockUseWorkoutsPageState.mockReturnValue(state)
        mockUseWorkoutTemplatesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 10,
                        name: 'Силовая A',
                        type: 'strength',
                        exercises: [{ exercise_id: 1 }],
                    },
                ],
            },
            isPending: false,
            error: null,
        })

        renderPage()

        fireEvent.click(screen.getAllByRole('button', { name: /Начать по шаблону Силовая A/i })[0])
        expect(state.handleStartFromTemplate).toHaveBeenCalledWith(10, 'Силовая A')
    })

    it('renders empty states and allows starting empty workout', () => {
        const state = makePageState()
        mockUseWorkoutsPageState.mockReturnValue(state)

        renderPage()

        expect(screen.getByText('Нет сохранённых шаблонов')).toBeInTheDocument()
        expect(screen.getByText('История пока пуста')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('start-workout-main-btn'))
        fireEvent.click(screen.getByRole('button', { name: /Пустая тренировка/i }))
        expect(state.handleStartEmpty).toHaveBeenCalled()
    })

    it('disables template start buttons while workout start is pending (fast-click guard)', () => {
        const state = makePageState({ isStartingWorkout: true })
        mockUseWorkoutsPageState.mockReturnValue(state)
        mockUseWorkoutTemplatesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 22,
                        name: 'Быстрый старт',
                        type: 'strength',
                        exercises: [{ exercise_id: 1 }],
                    },
                ],
            },
            isPending: false,
            error: null,
        })

        renderPage()

        const btn = screen.getAllByRole('button', { name: /Начать по шаблону Быстрый старт/i })[0]
        expect(btn).toBeDisabled()
        fireEvent.click(btn)
        expect(state.handleStartFromTemplate).not.toHaveBeenCalled()
    })
})

