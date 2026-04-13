import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useCreateCustomExerciseMutation } from '../useExerciseMutations'
import { exercisesApi } from '@shared/api/domains/exercisesApi'

vi.mock('@shared/api/domains/exercisesApi', () => ({
    exercisesApi: {
        createCustom: vi.fn(),
    },
}))

describe('useCreateCustomExerciseMutation', () => {
    function createWrapper(client: QueryClient) {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return <QueryClientProvider client={client}>{children}</QueryClientProvider>
        }
    }

    beforeEach(() => {
        vi.mocked(exercisesApi.createCustom).mockReset()
    })

    it('calls exercisesApi.createCustom and invalidates exercises list query on success', async () => {
        const qc = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })

        const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
        vi.mocked(exercisesApi.createCustom).mockResolvedValue({
            id: 1,
            name: 'My custom exercise',
            description: 'Some description',
            category: 'strength',
            equipment: ['dumbbells'],
            muscle_group: 'Chest',
            muscle_groups: ['Chest'],
            aliases: [],
            risk_flags: {
                high_blood_pressure: false,
                diabetes: false,
                joint_problems: false,
                back_problems: false,
                heart_conditions: false,
            },
            media_url: null,
            status: 'pending',
            author_user_id: 123,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        const { result } = renderHook(() => useCreateCustomExerciseMutation(), {
            wrapper: createWrapper(qc),
        })

        const fd = new FormData()
        fd.append('name', 'My custom exercise')
        fd.append('category', 'strength')
        fd.append('description', 'Some description')
        fd.append('equipment', JSON.stringify(['dumbbells']))
        fd.append('target_muscles', JSON.stringify(['Chest']))
        fd.append('risks', JSON.stringify([]))
        fd.append('difficulty', 'beginner')

        result.current.mutate(fd)

        await waitFor(() => {
            expect(exercisesApi.createCustom).toHaveBeenCalledTimes(1)
        })
        expect(exercisesApi.createCustom).toHaveBeenCalledWith(fd)

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ['exercises', 'list'],
            })
        })
    })
})
