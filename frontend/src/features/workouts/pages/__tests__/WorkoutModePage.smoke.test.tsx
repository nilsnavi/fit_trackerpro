/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Smoke test for WorkoutModePage.
 *
 * Goal: verify the page mounts and renders key interactive elements without
 * touching real network / Telegram API / offline queue.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ── Dependency mocks ──────────────────────────────────────────────────────────

const mockMutate = jest.fn()
const mockMutateAsync = jest.fn()

jest.mock('@features/workouts/hooks/useWorkoutMutations', () => ({
    useStartWorkoutMutation: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
    useUpdateWorkoutSessionMutation: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
    useCreateWorkoutTemplateMutation: () => ({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
    }),
}))

jest.mock('@features/workouts/hooks/useWorkoutHistoryQuery', () => ({
    useWorkoutHistoryQuery: () => ({ data: { items: [] } }),
}))

jest.mock('@features/exercises/hooks/useExercisesCatalogQuery', () => ({
    useExercisesCatalogQuery: () => ({ data: [], isLoading: false, isError: false }),
}))

// Zustand store — real implementation, reset between tests
import { useWorkoutModeEditorStore } from '@features/workouts/stores/useWorkoutModeEditorStore'
jest.mock('@/state/local', () => ({
    useWorkoutSessionDraftStore: jest.fn(() => jest.fn()),
}))

// Telegram WebApp mock (used transitively by some shared UI)
jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: () => ({
        isTelegram: false,
        hapticFeedback: { impactOccurred: jest.fn(), notificationOccurred: jest.fn() },
    }),
}))

// Offline sync queue uses import.meta (ESM) — mock the whole module
jest.mock('@shared/offline/syncQueue', () => ({
    isOfflineMutationQueuedError: jest.fn(() => false),
    enqueueOfflineTemplateCreate: jest.fn(),
    enqueueOfflineWorkoutStart: jest.fn(),
}))

// Avoid rendering SVG icons crashing jsdom
jest.mock('lucide-react', () => {
    const React = require('react')
    const Icon = (_props: object) => React.createElement('span')
    return new Proxy({}, { get: () => Icon })
})

// ── Test helper ───────────────────────────────────────────────────────────────

// WorkoutModePage is a default export
import WorkoutModePage from '../WorkoutModePage'

function renderPage(mode = 'strength') {
    return render(
        <MemoryRouter initialEntries={[`/workouts/mode/${mode}`]}>
            <Routes>
                <Route path="/workouts/mode/:mode" element={<WorkoutModePage />} />
                <Route path="/workouts" element={<div>Workouts list</div>} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    useWorkoutModeEditorStore.getState().reset()
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WorkoutModePage smoke', () => {
    it('mounts without throwing for strength mode', () => {
        expect(() => renderPage('strength')).not.toThrow()
    })

    it('renders title input', () => {
        renderPage('strength')
        expect(screen.getByLabelText(/название тренировки/i)).toBeInTheDocument()
    })

    it('renders Save and SaveAndStart buttons', () => {
        renderPage('strength')
        expect(screen.getByRole('button', { name: /сохранить и начать/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^сохранить$/i })).toBeInTheDocument()
    })

    it('renders empty-state add-exercise button', () => {
        renderPage('strength')
        expect(
            screen.getByRole('button', { name: /добавить упражнение/i }),
        ).toBeInTheDocument()
    })

    it('renders gracefully for cardio mode', () => {
        renderPage('cardio')
        expect(screen.getByLabelText(/название тренировки/i)).toBeInTheDocument()
    })

    it('shows fallback UI for unknown mode', () => {
        renderPage('unknown_xyz')
        expect(screen.getByText(/неизвестный режим/i)).toBeInTheDocument()
    })
})
