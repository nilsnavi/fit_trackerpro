import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Table2 } from 'lucide-react'
import { queryKeys } from '@shared/api/queryKeys'
import { getErrorMessage } from '@shared/errors'
import {
    getAnalyticsTrainingLoadDailyTable,
    type ApiTrainingLoadDailyEntry,
} from '@features/analytics/api/analyticsDomain'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { cn } from '@shared/lib/cn'

interface TrainingLoadTableProps {
    dateFrom: string | null
    dateTo: string | null
    pageSize?: number
}

export function TrainingLoadTable({
    dateFrom,
    dateTo,
    pageSize = 10,
}: TrainingLoadTableProps) {
    const tg = useTelegramWebApp()
    const [page, setPage] = useState(1)

    const {
        data,
        isLoading,
        isError,
        error,
        isFetching,
    } = useQuery({
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

    const items = data?.items ?? []
    const total = data?.total ?? 0
    const totalPages = Math.ceil(total / pageSize)

    const handlePrevPage = () => {
        if (page > 1) {
            setPage(page - 1)
            tg.hapticFeedback({ type: 'selection' })
        }
    }

    const handleNextPage = () => {
        if (page < totalPages) {
            setPage(page + 1)
            tg.hapticFeedback({ type: 'selection' })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                Ошибка загрузки: {getErrorMessage(error)}
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-telegram-secondary-bg/60 px-4 py-8 text-center">
                <Table2 className="mx-auto h-8 w-8 text-telegram-hint" />
                <p className="mt-2 text-sm text-telegram-hint">
                    Нет данных о нагрузке за выбранный период
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Table Header - Mobile Friendly */}
            <div className="hidden rounded-t-2xl bg-telegram-secondary-bg/80 px-4 py-2 sm:block">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-telegram-hint">
                    <span>Дата</span>
                    <span className="text-right">Нагрузка</span>
                    <span className="text-right">Объём</span>
                    <span className="text-right">RPE</span>
                </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-telegram-secondary-bg">
                {items.map((item, index) => (
                    <TableRow
                        key={`${item.date}-${index}`}
                        item={item}
                        isLast={index === items.length - 1}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between rounded-xl bg-telegram-secondary-bg px-4 py-3">
                    <button
                        type="button"
                        onClick={handlePrevPage}
                        disabled={page === 1 || isFetching}
                        className={cn(
                            'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            page === 1
                                ? 'cursor-not-allowed text-telegram-hint/50'
                                : 'text-telegram-text hover:bg-telegram-bg'
                        )}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Назад</span>
                    </button>

                    <div className="flex items-center gap-2 text-sm">
                        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        <span className="text-telegram-hint">
                            {page} / {totalPages}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={page === totalPages || isFetching}
                        className={cn(
                            'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            page === totalPages
                                ? 'cursor-not-allowed text-telegram-hint/50'
                                : 'text-telegram-text hover:bg-telegram-bg'
                        )}
                    >
                        <span>Далее</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Total count */}
            <p className="text-center text-xs text-telegram-hint">
                Всего записей: {total}
            </p>
        </div>
    )
}

function TableRow({
    item,
    isLast,
}: {
    item: ApiTrainingLoadDailyEntry
    isLast: boolean
}) {
    const formattedDate = useMemo(() => {
        try {
            const date = new Date(item.date)
            return format(date, 'd MMM', { locale: ru })
        } catch {
            return item.date
        }
    }, [item.date])

    const fullDate = useMemo(() => {
        try {
            const date = new Date(item.date)
            return format(date, 'd MMMM yyyy', { locale: ru })
        } catch {
            return item.date
        }
    }, [item.date])

    return (
        <div
            className={cn(
                'px-4 py-3 transition-colors hover:bg-telegram-bg/50',
                !isLast && 'border-b border-border/30'
            )}
        >
            {/* Mobile Layout */}
            <div className="sm:hidden">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-telegram-text">{formattedDate}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-telegram-hint">Нагр.</span>
                        <span className="text-sm font-semibold text-telegram-text">
                            {item.fatigueScore}
                        </span>
                    </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-telegram-hint">
                    <span>Объём: <span className="font-medium text-telegram-text">{item.volume}</span></span>
                    <span>RPE: <span className="font-medium text-telegram-text">{item.avgRpe ?? '—'}</span></span>
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:grid sm:grid-cols-4 sm:gap-2 sm:text-sm">
                <span className="text-telegram-text" title={fullDate}>
                    {formattedDate}
                </span>
                <span className="text-right font-medium text-telegram-text">
                    {item.fatigueScore}
                </span>
                <span className="text-right text-telegram-text">{item.volume}</span>
                <span className="text-right text-telegram-text">
                    {item.avgRpe ?? '—'}
                </span>
            </div>
        </div>
    )
}
