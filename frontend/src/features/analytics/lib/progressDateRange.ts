import { format, subDays } from 'date-fns'

export type ProgressPeriod = '7d' | '30d' | '90d' | 'all'

export interface ProgressPeriodOption {
    id: ProgressPeriod
    label: string
}

export const PROGRESS_PERIODS: ProgressPeriodOption[] = [
    { id: '7d', label: '7д' },
    { id: '30d', label: '30д' },
    { id: '90d', label: '90д' },
    { id: 'all', label: 'Все' },
]

export const PROGRESS_PERIODS_SHORT = PROGRESS_PERIODS.filter((item) => item.id !== 'all')

export function getAnalyticsDateRange(period: ProgressPeriod): { date_from?: string; date_to?: string } {
    if (period === 'all') {
        return {}
    }

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

    return {
        date_from: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
        date_to: format(new Date(), 'yyyy-MM-dd'),
    }
}