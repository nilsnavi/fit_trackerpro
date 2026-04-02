/**
 * useProfile — серверное состояние профиля через TanStack Query.
 */
import { useCallback, useMemo } from 'react'
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { getErrorMessage } from '@shared/errors'
import { queryKeys } from '@shared/api/queryKeys'
import { authApi } from '@features/profile/api/authApi'
import { usersApi } from '@shared/api/domains/usersApi'
import type {
    CoachAccess,
    UserProfile,
    UserStats,
    WeightProgress,
} from '@features/profile/types/profile'

export type {
    UserProfile,
    UserStats,
    CoachAccess,
    WeightProgress,
} from '@features/profile/types/profile'

const calculateWeightProgress = (current: number, target: number, start: number): number => {
    if (start === target) return 100
    const totalDiff = Math.abs(start - target)
    const currentDiff = Math.abs(current - target)
    const progress = ((totalDiff - currentDiff) / totalDiff) * 100
    return Math.max(0, Math.min(100, progress))
}

const calculateGoalDate = (current: number, target: number, weeklyChange: number = 0.5): Date => {
    const diff = Math.abs(current - target)
    const weeksNeeded = diff / weeklyChange
    const goalDate = new Date()
    goalDate.setDate(goalDate.getDate() + weeksNeeded * 7)
    return goalDate
}

export interface UseProfileReturn {
    profile: UserProfile | null
    stats: UserStats | null
    coachAccesses: CoachAccess[]
    isLoading: boolean
    isGeneratingCoachCode: boolean
    error: string | null
    updateProfile: (updates: Partial<UserProfile['profile']>) => Promise<void>
    updateSettings: (updates: Partial<UserProfile['settings']>) => Promise<void>
    updateWeight: (current: number, target?: number) => Promise<void>
    getWeightProgress: () => WeightProgress | null
    generateCoachCode: () => Promise<string | null>
    revokeCoachAccess: (accessId: string) => Promise<void>
    exportData: () => Promise<void>
    refresh: () => Promise<void>
}

export function useProfile(): UseProfileReturn {
    const queryClient = useQueryClient()
    const { hapticFeedback, showAlert } = useTelegramWebApp()

    const profileQuery = useQuery({
        queryKey: queryKeys.profile.me,
        queryFn: () => authApi.getCurrentUser(),
    })

    const statsQuery = useQuery({
        queryKey: queryKeys.profile.stats,
        queryFn: () => usersApi.getStats(),
    })

    const coachAccessQuery = useQuery({
        queryKey: queryKeys.profile.coachAccess,
        queryFn: () => usersApi.getCoachAccess(),
    })

    const updateProfileMutation = useMutation({
        mutationFn: async (updates: Partial<UserProfile['profile']>) => {
            return authApi.updateCurrentUser({
                profile: updates,
            })
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.profile.me, data)
        },
    })

    const updateSettingsMutation = useMutation({
        mutationFn: async (updates: Partial<UserProfile['settings']>) => {
            return authApi.updateCurrentUser({
                settings: updates,
            })
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.profile.me, data)
        },
    })

    const generateCoachMutation = useMutation({
        mutationFn: () => usersApi.generateCoachAccess(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.profile.coachAccess })
        },
    })

    const revokeCoachMutation = useMutation({
        mutationFn: (accessId: string) => usersApi.revokeCoachAccess(accessId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.profile.coachAccess })
        },
    })

    const profile = profileQuery.data ?? null
    const stats = statsQuery.data ?? null
    const coachAccesses = coachAccessQuery.data ?? []

    const isLoading =
        profileQuery.isPending || statsQuery.isPending || coachAccessQuery.isPending

    const error =
        profileQuery.error != null
            ? 'Не удалось загрузить профиль'
            : null

    const updateProfile = useCallback(
        async (updates: Partial<UserProfile['profile']>) => {
            try {
                await updateProfileMutation.mutateAsync(updates)
                hapticFeedback({ type: 'notification', notificationType: 'success' })
            } catch (err) {
                console.error('Failed to update profile:', err)
                hapticFeedback({ type: 'notification', notificationType: 'error' })
                await showAlert(`Не удалось сохранить профиль: ${getErrorMessage(err)}`)
                throw err
            }
        },
        [updateProfileMutation, hapticFeedback, showAlert],
    )

    const updateSettings = useCallback(
        async (updates: Partial<UserProfile['settings']>) => {
            try {
                await updateSettingsMutation.mutateAsync(updates)
                hapticFeedback({ type: 'notification', notificationType: 'success' })
            } catch (err) {
                console.error('Failed to update settings:', err)
                hapticFeedback({ type: 'notification', notificationType: 'error' })
                await showAlert(`Не удалось сохранить настройки: ${getErrorMessage(err)}`)
                throw err
            }
        },
        [updateSettingsMutation, hapticFeedback, showAlert],
    )

    const updateWeight = useCallback(
        async (current: number, target?: number) => {
            const updates: Partial<UserProfile['profile']> = { current_weight: current }
            if (target !== undefined) updates.target_weight = target
            await updateProfile(updates)
        },
        [updateProfile],
    )

    const getWeightProgress = useCallback((): WeightProgress | null => {
        if (!profile?.profile.current_weight || !profile?.profile.target_weight) return null

        const current = profile.profile.current_weight
        const target = profile.profile.target_weight
        const start = current + (current > target ? 5 : -5)

        return {
            current,
            target,
            start,
            progress: calculateWeightProgress(current, target, start),
            diff: Math.abs(current - target),
            goalDate: calculateGoalDate(current, target),
        }
    }, [profile])

    const generateCoachCode = useCallback(async (): Promise<string | null> => {
        try {
            const res = await generateCoachMutation.mutateAsync()
            hapticFeedback({ type: 'notification', notificationType: 'success' })
            return res.code
        } catch (err) {
            console.error('Failed to generate coach code:', err)
            return null
        }
    }, [generateCoachMutation, hapticFeedback])

    const revokeCoachAccess = useCallback(
        async (accessId: string) => {
            try {
                await revokeCoachMutation.mutateAsync(accessId)
                hapticFeedback({ type: 'notification', notificationType: 'success' })
            } catch (err) {
                console.error('Failed to revoke access:', err)
                throw err
            }
        },
        [revokeCoachMutation, hapticFeedback],
    )

    const exportData = useCallback(async () => {
        try {
            const response = await usersApi.exportData()
            const url = window.URL.createObjectURL(response)
            const a = document.createElement('a')
            a.href = url
            a.download = `fittracker-data-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            window.URL.revokeObjectURL(url)
            hapticFeedback({ type: 'notification', notificationType: 'success' })
        } catch (err) {
            console.error('Failed to export data:', err)
            throw err
        }
    }, [hapticFeedback])

    const refresh = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.me }),
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats }),
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.coachAccess }),
        ])
    }, [queryClient])

    return useMemo(
        () => ({
            profile,
            stats,
            coachAccesses,
            isLoading,
            isGeneratingCoachCode: generateCoachMutation.isPending,
            error,
            updateProfile,
            updateSettings,
            updateWeight,
            getWeightProgress,
            generateCoachCode,
            revokeCoachAccess,
            exportData,
            refresh,
        }),
        [
            profile,
            stats,
            coachAccesses,
            isLoading,
            generateCoachMutation.isPending,
            error,
            updateProfile,
            updateSettings,
            updateWeight,
            getWeightProgress,
            generateCoachCode,
            revokeCoachAccess,
            exportData,
            refresh,
        ],
    )
}

export default useProfile
