/**
 * Данные виджетов здоровья на главной (WS2-2): вода, глюкоза, самочувствие.
 *
 * Виджеты — презентационные, поэтому вся связка «API → DTO виджета» собрана
 * здесь: главная получает уже готовые значения и один статус загрузки/ошибки,
 * а не три независимых запроса. Пустые ответы — это не ошибка, виджеты
 * показывают «Нет данных».
 */
import { useMemo } from 'react'
import {
    useGlucoseReadingsQuery,
    useWellnessByDateQuery,
} from '@features/health/hooks/useHealthQueries'
import {
    glucoseReadingToGlucoseData,
    wellnessEntryToWellnessData,
} from '@features/home/lib/mapHealthToDashboard'
import { useHomeWaterQuery } from '@features/home/hooks/useHomeWaterQuery'

const GLUCOSE_LAST_READING_LIMIT = 1

function todayIso(): string {
    return new Date().toISOString().slice(0, 10)
}

export function useHomeHealthWidgets() {
    const water = useHomeWaterQuery()
    const glucoseQuery = useGlucoseReadingsQuery(GLUCOSE_LAST_READING_LIMIT)
    const wellnessQuery = useWellnessByDateQuery(todayIso())

    const glucose = useMemo(() => {
        const last = glucoseQuery.data?.[0]
        return last ? glucoseReadingToGlucoseData(last) : null
    }, [glucoseQuery.data])

    const wellness = useMemo(() => {
        const entries = wellnessQuery.data ?? []
        const today = todayIso()
        const entry = entries.find((item) => item.date === today) ?? entries[0] ?? null
        return wellnessEntryToWellnessData(entry)
    }, [wellnessQuery.data])

    return {
        water: water.data,
        glucose,
        wellness,
        isPending: water.isPending || glucoseQuery.isPending || wellnessQuery.isPending,
        isError: water.isError || glucoseQuery.isError || wellnessQuery.isError,
        refetch: async () => {
            await Promise.all([water.refetch(), glucoseQuery.refetch(), wellnessQuery.refetch()])
        },
    }
}
