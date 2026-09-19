import { act, renderHook, waitFor } from '@testing-library/react'

import { useOnboardingSubmit } from '@/hooks/useOnboardingSubmit'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@shared/api/client', () => ({
    api: {
        put: jest.fn(),
        post: jest.fn(),
    },
}))

function fetchResponse(ok: boolean, status: number, body: unknown) {
    return { ok, status, json: async () => body }
}

describe('useOnboardingSubmit', () => {
    const onDone = jest.fn()
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        jest.clearAllMocks()
        useAuthStore.getState().clear()
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('сохраняет имя, затем онбординг, и отдаёт управление экрану', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.put as jest.Mock).mockResolvedValue({})
        ;(api.post as jest.Mock).mockResolvedValue({})

        const { result } = renderHook(() => useOnboardingSubmit(onDone))

        await act(async () => {
            await result.current.submit({
                displayName: '  Аня  ',
                fitnessGoal: 'strength',
                experienceLevel: 'beginner',
            })
        })

        expect(api.put).toHaveBeenCalledWith('/users/auth/me', { first_name: 'Аня' })
        expect(api.post).toHaveBeenCalledWith('/users/auth/onboarding', {
            fitness_goal: 'strength',
            experience_level: 'beginner',
        })
        expect(onDone).toHaveBeenCalledTimes(1)
        expect(result.current.error).toBeNull()
        expect(result.current.isSubmitting).toBe(false)
    })

    it('не трогает профиль при пустом имени, но онбординг сохраняет', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.post as jest.Mock).mockResolvedValue({})

        const { result } = renderHook(() => useOnboardingSubmit(onDone))

        await act(async () => {
            await result.current.submit({
                displayName: '   ',
                fitnessGoal: 'endurance',
                experienceLevel: 'advanced',
            })
        })

        expect(api.put).not.toHaveBeenCalled()
        expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('при отказе сохранения профиля останавливается и показывает ошибку', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.put as jest.Mock).mockRejectedValue(new Error('имя не подошло'))

        const { result } = renderHook(() => useOnboardingSubmit(onDone))

        await act(async () => {
            await result.current.submit({
                displayName: 'Аня',
                fitnessGoal: 'strength',
                experienceLevel: 'beginner',
            })
        })

        expect(api.post).not.toHaveBeenCalled()
        expect(onDone).not.toHaveBeenCalled()
        expect(result.current.error).toBeTruthy()
        expect(result.current.isSubmitting).toBe(false)
    })

    it('при отказе клиента API уходит на резервный fetch с токеном', async () => {
        const { api } = await import('@shared/api/client')
        useAuthStore.getState().setTokens({ accessToken: 'token-1', refreshToken: null })
        ;(api.put as jest.Mock).mockResolvedValue({})
        ;(api.post as jest.Mock).mockRejectedValue(new Error('client unavailable'))

        const fetchMock = jest.fn().mockResolvedValue(fetchResponse(true, 200, {}))
        globalThis.fetch = fetchMock as unknown as typeof fetch

        const { result } = renderHook(() => useOnboardingSubmit(onDone))

        await act(async () => {
            await result.current.submit({
                displayName: 'Аня',
                fitnessGoal: 'weight_loss',
                experienceLevel: 'intermediate',
            })
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain('/users/auth/onboarding')
        expect((init as RequestInit).method).toBe('POST')
        expect((init as Record<string, Record<string, string>>).headers.Authorization).toBe('Bearer token-1')
        expect(JSON.parse(String((init as RequestInit).body))).toEqual({
            fitness_goal: 'weight_loss',
            experience_level: 'intermediate',
        })
        expect(result.current.error).toBeNull()
    })

    it('показывает сообщение сервера, когда и резервный fetch отказал', async () => {
        const { api } = await import('@shared/api/client')
        ;(api.put as jest.Mock).mockResolvedValue({})
        ;(api.post as jest.Mock).mockRejectedValue(new Error('client unavailable'))

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(fetchResponse(false, 400, { detail: 'Цель обязательна' })) as unknown as typeof fetch

        const { result } = renderHook(() => useOnboardingSubmit(onDone))

        await act(async () => {
            await result.current.submit({
                displayName: 'Аня',
                fitnessGoal: 'strength',
                experienceLevel: 'beginner',
            })
        })

        await waitFor(() => expect(result.current.error).toContain('Цель обязательна'))
        expect(onDone).not.toHaveBeenCalled()
    })
})
