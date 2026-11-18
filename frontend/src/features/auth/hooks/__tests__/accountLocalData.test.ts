import { QueryClient } from '@tanstack/react-query'
import { prepareAccountLocalData } from '../usePrepareAccountLocalData'
import { getQueueSize } from '@shared/offline/offlineQueue'
import { createOfflineQueryPersister } from '@shared/offline/offlineQueryPersist'

jest.mock('@shared/offline/offlineQueue', () => ({ getQueueSize: jest.fn() }))
jest.mock('@shared/offline/syncQueue', () => ({ hasSavedSyncMutations: () => false }))
jest.mock('@shared/offline/offlineQueryPersist', () => ({
    createOfflineQueryPersister: jest.fn(() => ({ removeClient: jest.fn().mockResolvedValue(undefined) })),
}))

const accountKey = 'fittracker-device-account'
const history = ['workouts', 'history']

beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    jest.mocked(getQueueSize).mockReturnValue(0)
})

it('keeps saved workout history when the same account signs in again', async () => {
    const queryClient = new QueryClient()
    localStorage.setItem(accountKey, '41')
    queryClient.setQueryData(history, ['saved workout'])

    await prepareAccountLocalData(queryClient, 41, false)

    expect(queryClient.getQueryData(history)).toEqual(['saved workout'])
    expect(createOfflineQueryPersister).not.toHaveBeenCalled()
})

it('refuses an account switch while another account has unsent workouts', async () => {
    const queryClient = new QueryClient()
    localStorage.setItem(accountKey, '41')
    jest.mocked(getQueueSize).mockReturnValue(1)

    await expect(prepareAccountLocalData(queryClient, 42, false)).rejects.toThrow('незавершённая тренировка')
    expect(localStorage.getItem(accountKey)).toBe('41')
    expect(createOfflineQueryPersister).not.toHaveBeenCalled()
})

it('clears the previous account cache before allowing a different account', async () => {
    const queryClient = new QueryClient()
    localStorage.setItem(accountKey, '41')
    queryClient.setQueryData(history, ['saved workout'])

    await prepareAccountLocalData(queryClient, 42, false)

    expect(queryClient.getQueryData(history)).toBeUndefined()
    const persister = jest.mocked(createOfflineQueryPersister).mock.results[0].value
    expect(persister.removeClient).toHaveBeenCalled()
    expect(localStorage.getItem(accountKey)).toBe('42')
})
