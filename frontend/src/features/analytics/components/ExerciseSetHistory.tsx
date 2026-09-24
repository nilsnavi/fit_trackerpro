import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Dumbbell } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface SetHistoryItem {
    date: string
    weight: number | null
    reps: number | null
    sets: number
}

interface ExerciseSetHistoryProps {
    history: SetHistoryItem[]
    className?: string
}

export function ExerciseSetHistory({ history, className }: ExerciseSetHistoryProps) {
    if (history.length === 0) {
        return (
            <div className={cn('rounded-xl bg-telegram-secondary-bg p-6 text-center', className)}>
                <Dumbbell className="mx-auto h-12 w-12 text-telegram-hint opacity-50" />
                <p className="mt-3 text-sm text-telegram-hint">История подходов пуста</p>
            </div>
        )
    }

    // Группируем по датам и сортируем от новых к старым
    const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date))

    return (
        <div className={cn('rounded-xl bg-telegram-secondary-bg', className)}>
            <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-telegram-text">История подходов</h3>
            </div>
            
            <div className="divide-y divide-border">
                {sortedHistory.map((item, index) => (
                    <div key={index} className="px-4 py-3 transition-colors hover:bg-telegram-bg">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-telegram-hint">
                                    {format(parseISO(item.date), 'dd MMMM yyyy', { locale: ru })}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {item.weight !== null && (
                                        <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                            {item.weight} кг
                                        </span>
                                    )}
                                    {item.reps !== null && (
                                        <span className="inline-flex items-center rounded-lg bg-telegram-bg px-2.5 py-1 text-xs font-medium text-telegram-text">
                                            {item.reps} повт.
                                        </span>
                                    )}
                                    <span className="inline-flex items-center rounded-lg bg-telegram-bg px-2.5 py-1 text-xs font-medium text-telegram-hint">
                                        {item.sets} подх.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
