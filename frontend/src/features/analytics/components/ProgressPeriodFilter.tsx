import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { cn } from '@shared/lib/cn'
import type { ProgressPeriod, ProgressPeriodOption } from '@features/analytics/lib/progressDateRange'

interface ProgressPeriodFilterProps {
    value: ProgressPeriod
    options: ProgressPeriodOption[]
    onChange: (period: ProgressPeriod) => void
}

export function ProgressPeriodFilter({ value, options, onChange }: ProgressPeriodFilterProps) {
    const tg = useTelegramWebApp()

    return (
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar" aria-label="Фильтр периода прогресса">
            {options.map((item) => {
                const isActive = item.id === value

                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                            tg.hapticFeedback({ type: 'selection' })
                            onChange(item.id)
                        }}
                        className={cn(
                            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            isActive
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-transparent bg-telegram-bg text-telegram-hint',
                        )}
                        aria-pressed={isActive}
                    >
                        {item.label}
                    </button>
                )
            })}
        </div>
    )
}