import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import {
    getAnalyticsMuscleLoadTable,
    getAnalyticsTrainingLoadDailyTable,
} from '@features/analytics/api/analyticsDomain'

export interface LoadTableParams {
    dateFrom: string | null
    dateTo: string | null
    pageSize?: number
}

export interface MuscleLoadTableParams extends LoadTableParams {
    muscleGroup?: string
}

/**
 * Постраничные таблицы нагрузки: сеть, ключи запроса и пагинация живут здесь, а не в
 * компонентах. Компонент получает уже готовые строки и переходы по страницам.
 */
export function useMuscleLoadTable({ dateFrom, dateTo, pageSize = 10, muscleGroup }: MuscleLoadTableParams) {
    const [page, setPage] = useState(1)

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: queryKeys.analytics.muscleLoadTable(page, pageSize, dateFrom, dateTo, muscleGroup ?? null),
        queryFn: () =>
            getAnalyticsMuscleLoadTable({
                page,
                page_size: pageSize,
                date_from: dateFrom ?? undefined,
                date_to: dateTo ?? undefined,
                muscle_group: muscleGroup ?? undefined,
            }),
        staleTime: 60_000,
    })

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
        items: data?.items ?? [],
        total,
        totalPages,
        page: Math.min(page, totalPages),
        isLoading,
        isError,
        error,
        isFetching,
        goPrev: () => setPage((current) => Math.max(1, current - 1)),
        goNext: () => setPage((current) => Math.min(totalPages, current + 1)),
    }
}

/** Постраничная таблица дневной нагрузки и объёма. */
export function useTrainingLoadDailyTable({ dateFrom, dateTo, pageSize = 10 }: LoadTableParams) {
    const [page, setPage] = useState(1)

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: queryKeys.analytics.trainingLoadDailyTable(page, pageSize, dateFrom, dateTo),
        queryFn: () =>
            getAnalyticsTrainingLoadDailyTable({
                page,
                page_size: pageSize,
                date_from: dateFrom ?? undefined,
                date_to: dateTo ?? undefined,
            }),
        staleTime: 60_000,
    })

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
        items: data?.items ?? [],
        total,
        totalPages,
        page: Math.min(page, totalPages),
        isLoading,
        isError,
        error,
        isFetching,
        goPrev: () => setPage((current) => Math.max(1, current - 1)),
        goNext: () => setPage((current) => Math.min(totalPages, current + 1)),
    }
}
