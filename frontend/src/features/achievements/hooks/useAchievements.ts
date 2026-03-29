/**
 * useAchievements — серверные данные достижений через TanStack Query;
 * подписки на разблокировки и смена категории списка остаются в хуке (UI-слой).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { queryKeys } from '@shared/api/queryKeys'
import { achievementsApi } from '@features/achievements/api/achievementsApi'
import {
    useAchievementsListQuery,
    useAchievementUserStatsQuery,
} from '@features/achievements/hooks/useAchievementQueries'
import type {
    Achievement,
    AchievementCategory,
    AchievementUnlockData,
    UserAchievement,
    UserAchievementStats,
} from '@features/achievements/types'

export interface UseAchievementsReturn {
    achievements: Achievement[]
    userStats: UserAchievementStats | null
    isLoading: boolean
    error: string | null
    fetchAchievements: (category?: AchievementCategory) => void
    fetchUserStats: () => Promise<void>
    claimAchievement: (achievementId: number) => Promise<AchievementUnlockData | null>
    checkProgress: () => Promise<void>
    getAchievementById: (id: number) => Achievement | undefined
    getUserAchievement: (achievementId: number) => UserAchievement | undefined
    onAchievementUnlocked: (callback: (data: AchievementUnlockData) => void) => () => void
    checkForNewAchievements: () => Promise<void>
}

export function useAchievements(): UseAchievementsReturn {
    const queryClient = useQueryClient()
    const { hapticFeedback } = useTelegramWebApp()
    const [listCategory, setListCategory] = useState<AchievementCategory | 'all'>('all')

    const achievementsQuery = useAchievementsListQuery(listCategory)
    const userStatsQuery = useAchievementUserStatsQuery({ refetchInterval: 30_000 })

    const unlockedCallbacks = useRef<((data: AchievementUnlockData) => void)[]>([])
    const previousCompletedIds = useRef<Set<number>>(new Set())
    const isFirstUserStatsSync = useRef(true)

    useEffect(() => {
        const items = userStatsQuery.data?.items
        if (!items) return

        const completedIds = new Set(
            items.filter((ua) => ua.is_completed).map((ua) => ua.achievement_id),
        )

        if (isFirstUserStatsSync.current) {
            previousCompletedIds.current = completedIds
            isFirstUserStatsSync.current = false
            return
        }

        const newUnlocks = items.filter(
            (ua) => ua.is_completed && !previousCompletedIds.current.has(ua.achievement_id),
        )

        newUnlocks.forEach((ua) => {
            const unlockData: AchievementUnlockData = {
                unlocked: true,
                achievement: ua.achievement,
                points_earned: ua.achievement.points,
                new_total_points: userStatsQuery.data?.total_points ?? 0,
                message: `Достижение разблокировано: ${ua.achievement.name}`,
            }
            unlockedCallbacks.current.forEach((cb) => cb(unlockData))
        })

        previousCompletedIds.current = completedIds
    }, [userStatsQuery.data])

    const claimMutation = useMutation({
        mutationFn: (achievementId: number) => achievementsApi.claim(achievementId),
        onSuccess: async (response) => {
            if (response.unlocked) {
                hapticFeedback({ type: 'notification', notificationType: 'success' })
                unlockedCallbacks.current.forEach((cb) => cb(response))
            }
            await queryClient.invalidateQueries({ queryKey: queryKeys.achievements.user })
        },
    })

    const checkProgressMutation = useMutation({
        mutationFn: () => achievementsApi.checkProgress(),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.achievements.user })
        },
    })

    const achievements = achievementsQuery.data?.items ?? []
    const userStats = userStatsQuery.data ?? null

    const fetchAchievements = useCallback((category?: AchievementCategory) => {
        setListCategory(category ?? 'all')
    }, [])

    const fetchUserStats = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.achievements.user })
    }, [queryClient])

    const claimAchievement = useCallback(
        async (achievementId: number): Promise<AchievementUnlockData | null> => {
            try {
                return await claimMutation.mutateAsync(achievementId)
            } catch (err) {
                console.error('Failed to claim achievement:', err)
                return null
            }
        },
        [claimMutation],
    )

    const checkProgress = useCallback(async () => {
        try {
            await checkProgressMutation.mutateAsync()
        } catch (err) {
            console.error('Failed to check progress:', err)
        }
    }, [checkProgressMutation])

    const getAchievementById = useCallback(
        (id: number): Achievement | undefined => achievements.find((a) => a.id === id),
        [achievements],
    )

    const getUserAchievement = useCallback(
        (achievementId: number): UserAchievement | undefined =>
            userStats?.items.find((ua) => ua.achievement_id === achievementId),
        [userStats],
    )

    const onAchievementUnlocked = useCallback(
        (callback: (data: AchievementUnlockData) => void): (() => void) => {
            unlockedCallbacks.current.push(callback)
            return () => {
                const i = unlockedCallbacks.current.indexOf(callback)
                if (i > -1) unlockedCallbacks.current.splice(i, 1)
            }
        },
        [],
    )

    const checkForNewAchievements = useCallback(async () => {
        await userStatsQuery.refetch()
    }, [userStatsQuery])

    return {
        achievements,
        userStats,
        isLoading: achievementsQuery.isPending,
        error:
            achievementsQuery.error != null ? 'Не удалось загрузить достижения' : null,
        fetchAchievements,
        fetchUserStats,
        claimAchievement,
        checkProgress,
        getAchievementById,
        getUserAchievement,
        onAchievementUnlocked,
        checkForNewAchievements,
    }
}

export default useAchievements
