/**
 * Очередь модерации (P1-4): админ одобряет/отклоняет заявки, автор видит свои
 * упражнения «На проверке». Права определяет сервер (`is_admin`), фронт лишь
 * решает, какие кнопки показать.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ExerciseModerationSection } from '../ExerciseModerationSection'
import { useExerciseModerationQueue } from '@features/exercises/hooks/useExerciseModerationQueue'
import {
    useApproveExerciseMutation,
    useDeleteExerciseMutation,
} from '@features/exercises/hooks/useExerciseMutations'

jest.mock('@features/exercises/hooks/useExerciseModerationQueue', () => ({
    useExerciseModerationQueue: jest.fn(),
}))
jest.mock('@features/exercises/hooks/useExerciseMutations', () => ({
    useApproveExerciseMutation: jest.fn(),
    useDeleteExerciseMutation: jest.fn(),
}))

const mockQueue = jest.mocked(useExerciseModerationQueue)
const mockApprove = jest.mocked(useApproveExerciseMutation)
const mockReject = jest.mocked(useDeleteExerciseMutation)

function item(id: number, name: string) {
    return { id, name, description: `Описание ${name}`, status: 'pending', author_user_id: 5 }
}

function queueResult(items: ReturnType<typeof item>[], overrides: Record<string, unknown> = {}) {
    return {
        data: items,
        isPending: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        ...overrides,
    } as unknown as ReturnType<typeof useExerciseModerationQueue>
}

function mutation(overrides: Record<string, unknown> = {}) {
    return {
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isPending: false,
        variables: undefined,
        ...overrides,
    } as never
}

describe('ExerciseModerationSection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockApprove.mockReturnValue(mutation())
        mockReject.mockReturnValue(mutation())
    })

    it('renders nothing for a regular user without pending submissions', () => {
        mockQueue.mockReturnValue(queueResult([]))
        const { container } = render(<ExerciseModerationSection isAdmin={false} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the author their own pending exercises without moderation buttons', () => {
        mockQueue.mockReturnValue(queueResult([item(1, 'Жим гантелей')]))
        render(<ExerciseModerationSection isAdmin={false} />)

        expect(screen.getByText('Мои упражнения на проверке')).toBeInTheDocument()
        expect(screen.getByText('На проверке')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Одобрить/ })).not.toBeInTheDocument()
    })

    it('lets an admin approve a submission', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined)
        mockApprove.mockReturnValue(mutation({ mutateAsync }))
        mockQueue.mockReturnValue(queueResult([item(3, 'Тяга'), item(4, 'Присед')]))

        render(<ExerciseModerationSection isAdmin />)
        expect(screen.getByText('На модерации')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Одобрить «Присед»' }))
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(4))
    })

    it('asks for confirmation before rejecting', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined)
        mockReject.mockReturnValue(mutation({ mutateAsync }))
        mockQueue.mockReturnValue(queueResult([item(3, 'Тяга')]))
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

        render(<ExerciseModerationSection isAdmin />)
        const reject = screen.getByRole('button', { name: 'Отклонить «Тяга»' })

        fireEvent.click(reject)
        expect(mutateAsync).not.toHaveBeenCalled()

        fireEvent.click(reject)
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(3))
        confirmSpy.mockRestore()
    })

    it('reports a failed action inline', async () => {
        mockApprove.mockReturnValue(
            mutation({ mutateAsync: jest.fn().mockRejectedValue(new Error('Нет прав')) }),
        )
        mockQueue.mockReturnValue(queueResult([item(3, 'Тяга')]))

        render(<ExerciseModerationSection isAdmin />)
        fireEvent.click(screen.getByRole('button', { name: 'Одобрить «Тяга»' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось одобрить «Тяга»')
    })

    it('shows an empty queue to the admin', () => {
        mockQueue.mockReturnValue(queueResult([]))
        render(<ExerciseModerationSection isAdmin />)
        expect(screen.getByText('Новых заявок нет.')).toBeInTheDocument()
    })
})
