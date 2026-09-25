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
import { toast } from '@shared/stores/toastStore'
import { queryKeys } from '@shared/api/queryKeys'
import { authApi } from '@features/profile/api/authApi'
import { usersApi } from '@shared/api/domains/usersApi'
import { saveBlobAsFile } from '@shared/lib/saveBlobAsFile'
import type {
    UserProfile,
    UserStats,
    WeightProgress,
} from '@features/profile/types/profile'

export type {
    UserProfile,
    UserStats,
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
    isLoading: boolean
    error: string | null
    updateProfile: (updates: Partial<UserProfile['profile']>) => Promise<void>
    updateSettings: (updates: Partial<UserProfile['settings']>) => Promise<void>
    updateWeight: (current: number, target?: number) => Promise<void>
    getWeightProgress: () => WeightProgress | null
    /** Never rejects: failures are reported with a toast. */
    exportData: () => Promise<void>
    isExporting: boolean
    refresh: () => Promise<void>
}

export function useProfile(): UseProfileReturn {
    const queryClient = useQueryClient()
    const { hapticFeedback } = useTelegramWebApp()

    const profileQuery = useQuery({
        queryKey: queryKeys.profile.me,
        queryFn: () => authApi.getCurrentUser(),
    })

    const statsQuery = useQuery({
        queryKey: queryKeys.profile.stats,
        queryFn: () => usersApi.getStats(),
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

    const profile = profileQuery.data ?? null
    const stats = statsQuery.data ?? null
    const isLoading = profileQuery.isPending || statsQuery.isPending

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
                toast.error(`Не удалось сохранить профиль: ${getErrorMessage(err)}`)
                throw err
            }
        },
        [updateProfileMutation, hapticFeedback],
    )

    const updateSettings = useCallback(
        async (updates: Partial<UserProfile['settings']>) => {
            try {
                await updateSettingsMutation.mutateAsync(updates)
                hapticFeedback({ type: 'notification', notificationType: 'success' })
            } catch (err) {
                console.error('Failed to update settings:', err)
                hapticFeedback({ type: 'notification', notificationType: 'error' })
                toast.error(`Не удалось сохранить настройки: ${getErrorMessage(err)}`)
                throw err
            }
        },
        [updateSettingsMutation, hapticFeedback],
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

    const exportMutation = useMutation({ mutationFn: () => usersApi.exportData() })
    const { mutateAsync: requestExport, isPending: isExporting } = exportMutation

    const exportData = useCallback(async () => {
        try {
            const blob = await requestExport()
            const filename = `fittracker-data-${new Date().toISOString().split('T')[0]}.json`
            const result = await saveBlobAsFile(blob, filename)
            if (result === 'cancelled') return
            hapticFeedback({ type: 'notification', notificationType: 'success' })
            toast.success(result === 'shared' ? 'Файл с данными готов' : 'Файл с данными скачан')
        } catch (err) {
            console.error('Failed to export data:', err)
            hapticFeedback({ type: 'notification', notificationType: 'error' })
            toast.error(`Не удалось экспортировать данные: ${getErrorMessage(err)}`)
        }
    }, [requestExport, hapticFeedback])

    const refresh = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.me }),
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats }),
        ])
    }, [queryClient])

    return useMemo(
        () => ({
            profile,
            stats,
            isLoading,
            error,
            updateProfile,
            updateSettings,
            updateWeight,
            getWeightProgress,
            exportData,
            isExporting,
            refresh,
        }),
        [
            profile,
            stats,
            isLoading,
            error,
            updateProfile,
            updateSettings,
            updateWeight,
            getWeightProgress,
            exportData,
            isExporting,
            refresh,
        ],
    )
}

export default useProfile
