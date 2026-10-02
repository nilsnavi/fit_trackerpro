import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { coachApi } from '../api/coachApi'
import { useCreateCoachInvitation, useCreateCoachProfile, useResolveCoachInvitation, useAcceptCoachInvitation, useCreateCoachProgram, useCoachProgramAction, useUpdateCoachClient, useRevokeCoachClient } from './useCoachQueries'
import { queryKeys } from '@shared/api/queryKeys'

jest.mock('../api/coachApi', () => ({ coachApi: {
    createProfile: jest.fn(), createInvitation: jest.fn(), resolveInvitation: jest.fn(), acceptInvitation: jest.fn(),
    createProgram: jest.fn(), activateProgram: jest.fn(), archiveProgram: jest.fn(), assignProgram: jest.fn(),
    updateClient: jest.fn(), revokeClient: jest.fn(),
} }))

describe('Coach query mutations', () => {
    const makeWrapper = () => {
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        return { client, wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }
    }

    it('invalidates the server-backed profile after onboarding', async () => {
        const { client, wrapper } = makeWrapper()
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        jest.mocked(coachApi.createProfile).mockResolvedValue({} as never)
        const { result } = renderHook(() => useCreateCoachProfile(), { wrapper })
        await act(async () => { await result.current.mutateAsync({ display_name: 'Coach' }) })
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.coach.profile }))
    })

    it('refreshes subscription quotas after quota-changing coach mutations', async () => {
        const { client, wrapper } = makeWrapper()
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        jest.mocked(coachApi.createProgram).mockResolvedValue({} as never)
        jest.mocked(coachApi.archiveProgram).mockResolvedValue({} as never)
        jest.mocked(coachApi.updateClient).mockResolvedValue({} as never)
        jest.mocked(coachApi.revokeClient).mockResolvedValue(undefined as never)

        const { result: create } = renderHook(() => useCreateCoachProgram(), { wrapper })
        await act(async () => { await create.current.mutateAsync({ name: 'Program' } as never) })
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.coachSubscription.current }))

        invalidate.mockClear()
        const { result: action } = renderHook(() => useCoachProgramAction(31), { wrapper })
        await act(async () => { await action.current.archive.mutateAsync() })
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.coachSubscription.current }))

        invalidate.mockClear()
        const { result: update } = renderHook(() => useUpdateCoachClient(41), { wrapper })
        await act(async () => { await update.current.mutateAsync('ARCHIVED') })
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.coachSubscription.current }))

        invalidate.mockClear()
        const { result: revoke } = renderHook(() => useRevokeCoachClient(41), { wrapper })
        await act(async () => { await revoke.current.mutateAsync() })
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.coachSubscription.current }))
    })

    it('keeps resolve token out of query cache keys', async () => {
        const token = 'raw-secret-token'
        jest.mocked(coachApi.resolveInvitation).mockResolvedValue({} as never)
        const { client, wrapper } = makeWrapper()
        const { result } = renderHook(() => useResolveCoachInvitation(), { wrapper })
        await act(async () => { await result.current.resolve(token) })
        expect(client.getQueryCache().getAll().map((query) => JSON.stringify(query.queryKey)).join(' ')).not.toContain(token)
        expect(result.current.variables).toBeUndefined()
    })

    it('clears raw-token mutation result after gcTime zero', async () => {
        jest.mocked(coachApi.acceptInvitation).mockResolvedValue({} as never)
        const { wrapper } = makeWrapper()
        const { result } = renderHook(() => useAcceptCoachInvitation(), { wrapper })
        await act(async () => { await result.current.accept('secret-token') })
        expect(result.current.variables).toBeUndefined()
    })

    it('clears a successful create token but retains failure state for the page', async () => {
        const { wrapper } = makeWrapper()
        const { result } = renderHook(() => useCreateCoachInvitation(), { wrapper })
        jest.mocked(coachApi.createInvitation).mockResolvedValue({ token: 'secret-token' } as never)
        await act(async () => { await result.current.create() })
        expect(result.current.data).toBeUndefined()
        expect(result.current.variables).toBeUndefined()

        jest.mocked(coachApi.createInvitation).mockRejectedValueOnce(new Error('offline'))
        await act(async () => { await expect(result.current.create()).rejects.toThrow('offline') })
        expect(result.current.isError).toBe(true)
    })
})
