import { cn } from '@shared/lib/cn'

interface ProgressConsistencyDay {
    date: string
    label: string
    isActive: boolean
}

interface ProgressConsistencyStripProps {
    days: ProgressConsistencyDay[]
    className?: string
}

export function ProgressConsistencyStrip({ days, className }: ProgressConsistencyStripProps) {
    return (
        <div className={cn('space-y-3', className)}>
            <div className="grid grid-cols-7 gap-1.5">
                {days.map((day) => (
                    <div key={day.date} className="space-y-1 text-center">
                        <div
                            className={cn(
                                'h-8 rounded-xl border transition-colors',
                                day.isActive
                                    ? 'border-primary/25 bg-primary/15'
                                    : 'border-border bg-telegram-bg',
                            )}
                            title={`${day.label}: ${day.isActive ? 'есть тренировка' : 'пауза'}`}
                            aria-label={`${day.label}: ${day.isActive ? 'есть тренировка' : 'пауза'}`}
                        />
                        <p className="text-[10px] uppercase tracking-wide text-telegram-hint">{day.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-telegram-hint">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                    День с тренировкой
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-telegram-bg ring-1 ring-border" />
                    Пауза
                </span>
            </div>
        </div>
    )
}