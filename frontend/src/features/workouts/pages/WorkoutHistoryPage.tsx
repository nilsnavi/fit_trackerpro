import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, Flame, History } from 'lucide-react'
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_TYPE_LABELS,
    getWorkoutListTypeConfig,
} from '@features/workouts/config/workoutTypeConfigs'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { getErrorMessage } from '@shared/errors'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import type { WorkoutType } from '@shared/types'

const pad2 = (value: number) => String(value).padStart(2, '0')

const toIsoDateKey = (value: string): string => {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}/)
    if (direct != null) return direct[0]

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''

    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
}

const formatRuDate = (value: string): string => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(parsed)
}

export function WorkoutHistoryPage() {
    const navigate = useNavigate()
    const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')
    const [selectedDate, setSelectedDate] = useState('')
    const [completedOnly, setCompletedOnly] = useState(false)
    const [datePreset, setDatePreset] = useState<'none' | 'today' | '7d' | '30d'>('none')

    const {
        data: workoutHistory,
        isLoading,
        error,
    } = useWorkoutHistoryQuery()

    const historyItems = useMemo(
        () =>
            (workoutHistory?.items ?? []).map((item) => ({
                raw: item,
                mapped: toWorkoutListItem(item),
                dateKey: toIsoDateKey(item.date),
                formattedDate: formatRuDate(item.date),
            })),
        [workoutHistory],
    )

    const todayKey = useMemo(() => {
        const now = new Date()
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
    }, [])

    const filteredItems = useMemo(() => {
        const now = new Date()
        const rangeStart = new Date(now)
        if (datePreset === '7d') {
            rangeStart.setDate(now.getDate() - 6)
            rangeStart.setHours(0, 0, 0, 0)
        }
        if (datePreset === '30d') {
            rangeStart.setDate(now.getDate() - 29)
            rangeStart.setHours(0, 0, 0, 0)
        }

        return historyItems
            .filter(({ mapped }) => selectedType === 'all' || mapped.type === selectedType)
            .filter(({ raw }) => !completedOnly || (typeof raw.duration === 'number' && raw.duration > 0))
            .filter(({ dateKey, raw }) => {
                if (selectedDate !== '') return dateKey === selectedDate
                if (datePreset === 'none') return true
                if (datePreset === 'today') return dateKey === todayKey

                const parsedDate = new Date(dateKey || raw.date)
                if (Number.isNaN(parsedDate.getTime())) return false
                return parsedDate >= rangeStart && parsedDate <= now
            })
            .sort((a, b) => new Date(b.raw.date).getTime() - new Date(a.raw.date).getTime())
    }, [historyItems, selectedType, completedOnly, selectedDate, datePreset, todayKey])

    return (
        <div className="space-y-4 p-4">
            <div className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-3">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-telegram-hint" />
                    <h2 className="text-sm font-semibold text-telegram-text">Фильтры истории</h2>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    <button
                        type="button"
                        onClick={() => setSelectedType('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                            selectedType === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        }`}
                    >
                        Все типы
                    </button>
                    {WORKOUT_FILTER_TYPE_ORDER.map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setSelectedType(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                selectedType === type
                                    ? 'bg-primary text-white'
                                    : 'bg-telegram-bg text-telegram-text'
                            }`}
                        >
                            {getWorkoutListTypeConfig(type).filterLabel}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                        <span className="shrink-0">Дата</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(event) => {
                                setSelectedDate(event.target.value)
                                setDatePreset('none')
                            }}
                            className="min-w-0 flex-1 bg-transparent text-sm text-telegram-text outline-none"
                        />
                        {selectedDate !== '' && (
                            <button
                                type="button"
                                onClick={() => setSelectedDate('')}
                                className="text-primary"
                            >
                                Сброс
                            </button>
                        )}
                    </label>

                    <button
                        type="button"
                        onClick={() => setCompletedOnly((prev) => !prev)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                            completedOnly
                                ? 'bg-primary/15 text-primary'
                                : 'bg-telegram-bg text-telegram-text'
                        }`}
                    >
                            <span>Только завершённые</span>
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${
                                completedOnly ? 'bg-primary' : 'bg-telegram-hint'
                            }`}
                        />
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setDatePreset('today')
                            setSelectedDate('')
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            datePreset === 'today'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        }`}
                    >
                        Сегодня
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setDatePreset('7d')
                            setSelectedDate('')
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            datePreset === '7d'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        }`}
                    >
                        7 дней
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setDatePreset('30d')
                            setSelectedDate('')
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            datePreset === '30d'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        }`}
                    >
                        30 дней
                    </button>
                </div>
            </div>

            {isLoading ? (
                <WorkoutsHistoryBlockSkeleton />
            ) : (
                <>
                    {error && <div className="text-sm text-danger">{getErrorMessage(error)}</div>}

                    {!error && filteredItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                            <SectionEmptyState
                                icon={History}
                                title="Нет тренировок по выбранным фильтрам"
                                description="Измените тип, дату или отключите completed only, чтобы увидеть больше записей истории."
                                primaryAction={{
                                    label: 'Сбросить фильтры',
                                    onClick: () => {
                                        setSelectedType('all')
                                        setSelectedDate('')
                                        setDatePreset('none')
                                        setCompletedOnly(false)
                                    },
                                }}
                            />
                        </div>
                    )}

                    {!error &&
                        filteredItems.map(({ raw, mapped, formattedDate }) => {
                            const listCfg = getWorkoutListTypeConfig(mapped.type)
                            const TypeIcon = listCfg.icon
                            const showCalories = listCfg.ux.showCaloriesInSummary

                            return (
                                <button
                                    key={mapped.id}
                                    type="button"
                                    className="w-full rounded-xl bg-telegram-secondary-bg p-4 text-left active:scale-[0.99] transition-transform"
                                    onClick={() => navigate(`/workouts/${mapped.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-11 h-11 rounded-xl ${listCfg.listBadgeClass} flex items-center justify-center text-white shrink-0`}
                                        >
                                            <TypeIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-telegram-text truncate">{mapped.title}</h3>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-telegram-hint">
                                                <span>{formattedDate}</span>
                                                <span>{WORKOUT_TYPE_LABELS[mapped.type]}</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {mapped.duration} мин
                                                </span>
                                                {showCalories && (
                                                    <span className="flex items-center gap-1">
                                                        <Flame className="w-3 h-3" />
                                                        {mapped.calories} ккал
                                                    </span>
                                                )}
                                                {typeof raw.duration !== 'number' || raw.duration <= 0 ? (
                                                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">
                                                        Не завершена
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-telegram-hint shrink-0" />
                                    </div>
                                </button>
                            )
                        })}
                </>
            )}
        </div>
    )
}
