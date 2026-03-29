import { useMemo } from 'react'
import { useWaterGoalQuery, useWaterTodayQuery } from '@features/health/hooks/useHealthQueries'
import type { WaterData } from '@shared/types'

/** Вода за сегодня и дневная цель с health-metrics API. */
export function useHomeWaterQuery() {
    const goalQ = useWaterGoalQuery()
    const todayQ = useWaterTodayQuery()

    const data = useMemo((): WaterData | null => {
        if (!goalQ.data) return null
        const total = (todayQ.data ?? []).reduce((sum, e) => sum + e.amount, 0)
        return {
            current: total,
            goal: goalQ.data.daily_goal,
            unit: 'мл',
        }
    }, [goalQ.data, todayQ.data])

    return {
        data,
        isPending: goalQ.isPending || todayQ.isPending,
        isError: goalQ.isError || todayQ.isError,
    }
}
