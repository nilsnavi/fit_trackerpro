import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { coachApi } from '../api/coachApi'
import { CoachProgramBuilderPage } from './CoachProgramBuilderPage'

jest.mock('../hooks/useCoachQueries', () => ({
    useCoachProgram: () => ({
        data: {
            id: 31, coach_id: 10, name: 'Existing program', description: null,
            status: 'DRAFT', version: 2,
            days: [
                { id: 71, day_number: 1, name: 'Day 1', workout_template_id: 41, workout_template_name: 'Template', template_version: 1, notes: null, position: 0 },
                { id: 72, day_number: 2, name: 'Day 2', workout_template_id: 41, workout_template_name: 'Template', template_version: 1, notes: null, position: 1 },
            ],
        },
        isPending: false,
        isError: false,
    }),
    useCoachProfile: () => ({ data: { user_id: 10 }, isPending: false, isError: false }),
    useCreateCoachProgram: () => ({ mutateAsync: jest.fn(), error: null, isPending: false, reset: jest.fn() }),
}))

jest.mock('@features/workouts/hooks/useWorkoutTemplatesQuery', () => ({
    useWorkoutTemplatesQuery: () => ({
        data: { items: [{ id: 41, user_id: 10, name: 'Template', version: 1 }] },
        isPending: false,
        isError: false,
    }),
}))

jest.mock('../api/coachApi', () => ({ coachApi: {
    updateProgram: jest.fn(), deleteProgramDay: jest.fn(), updateProgramDay: jest.fn(), createProgramDay: jest.fn(),
} }))

function renderBuilder() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/coach/programs/31/edit']}><Routes><Route path="/coach/programs/:programId/edit" element={<CoachProgramBuilderPage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

describe('CoachProgramBuilderPage', () => {
    it('allocates the next day number from remaining days after deleting day 1', async () => {
        jest.mocked(coachApi.updateProgram).mockResolvedValue({ id: 31 } as never)
        jest.mocked(coachApi.deleteProgramDay).mockResolvedValue(undefined as never)
        jest.mocked(coachApi.updateProgramDay).mockResolvedValue({ id: 31 } as never)
        jest.mocked(coachApi.createProgramDay).mockResolvedValue({ id: 31 } as never)
        renderBuilder()

        await waitFor(() => expect(screen.getAllByLabelText('Название')[0]).toHaveValue('Existing program'))
        fireEvent.click(screen.getAllByRole('button', { name: 'Удалить день' })[0])
        fireEvent.click(screen.getByRole('button', { name: 'Добавить день' }))
        fireEvent.change(screen.getAllByLabelText('WorkoutTemplate')[1], { target: { value: '41' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить программу' }))

        await waitFor(() => expect(coachApi.createProgramDay).toHaveBeenCalledWith(31, expect.objectContaining({ day_number: 3 })))
    })
})
